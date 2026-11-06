import { fail, isResponse, json, requireAuth } from "@/lib/api";
import { audit, rateLimit } from "@/lib/auth/guards";
import { AiError, aiReady, aiTransport, transcribe } from "@/lib/ai";
import { TOOLS } from "@/lib/clinic/ai-tools";

const MAX = 8 * 1024 * 1024;
/** Dictation: audio is forwarded to the router and discarded; only the transcript comes back. */
export async function POST(req: Request) {
  const a = await requireAuth();
  if (isResponse(a)) return a;
  if (!TOOLS[a.user.role].includes("soap")) return fail("forbidden", 403);
  if (!aiReady) return fail("ai_not_configured", 503, "AI belum dikonfigurasi.");
  const tr = aiTransport();
  if (!tr.ok) return fail("insecure_transport", 503, tr.message);
  if (!(await rateLimit("ai-stt", a.user.id, 20, 3600))) return fail("rate_limited", 429, "Terlalu banyak dikte. Coba lagi nanti.");
  const f = (await req.formData().catch(() => null))?.get("audio");
  if (!(f instanceof Blob) || f.size < 800) return fail("validation", 400, "Rekaman kosong.");
  if (f.size > MAX || !/^(audio|video)\//.test(f.type)) return fail("validation", 400, "Rekaman terlalu besar atau format tidak didukung.");
  try {
    const t = await transcribe(f);
    await audit("ai.transcribe", a.user.id, { bytes: f.size });
    return json({ ok: true, text: t });
  } catch (e) {
    const code = e instanceof AiError ? e.code : "ai_error";
    await audit("ai.transcribe.failed", a.user.id, { code });
    return fail(code, 502, sttHint(code));
  }
}

/** Plain-language cause + what to do, so a failed dictation tells the user where to look. */
function sttHint(code: string) {
  if (code === "ai_unreachable") return "Server aplikasi tidak bisa menghubungi 9Router (cek NINEROUTER_BASE_URL, firewall, dan apakah 9Router menyala). [ai_unreachable]";
  if (code === "stt_model_unknown") return "Model dikte tidak ditemukan di 9Router. Tambahkan provider STT di 9Router atau isi NINEROUTER_STT_MODEL. [stt_model_unknown]";
  if (code === "stt_401" || code === "stt_403") return `9Router menolak kunci API (${code}). Periksa NINEROUTER_API_KEY.`;
  if (code === "stt_404") return "Endpoint atau model dikte tidak ada di 9Router (stt_404). Periksa NINEROUTER_STT_MODEL.";
  if (code === "stt_400" || code === "stt_415" || code === "stt_422") return `Model dikte menolak format rekaman (${code}). Coba model STT lain di NINEROUTER_STT_MODEL.`;
  if (code === "stt_empty") return "Suara tidak terdengar jelas. Coba bicara lebih dekat ke mikrofon.";
  return `Dikte gagal di 9Router (${code}). Lihat log server untuk detailnya.`;
}
