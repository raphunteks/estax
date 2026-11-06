import { fail, isResponse, requireAuth } from "@/lib/api";
import { rateLimit } from "@/lib/auth/guards";
import { AiError, speak } from "@/lib/ai";

export async function POST(req: Request) {
  const a = await requireAuth();
  if (isResponse(a)) return a;

  if (!(await rateLimit("ai-tts", a.user.id, 120, 3600))) {
    return fail("rate_limited", 429, "Terlalu banyak permintaan suara. Coba lagi sebentar.");
  }

  const body = await req.json().catch(() => null);
  const text = String(body?.text ?? "").trim();
  if (!text || text.length < 1) return fail("validation", 400, "Teks kosong.");
  if (text.length > 3000) return fail("validation", 400, "Teks terlalu panjang.");

  try {
    const audioBuf = await speak(text);
    return new Response(audioBuf, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "private, no-cache, no-store",
        "Content-Length": String(audioBuf.byteLength),
      },
    });
  } catch (e) {
    console.error("[ai/speech] error:", e);
    const code = e instanceof AiError ? e.code : "tts_failed";
    return fail(code, 502, "Gagal memproses suara.");
  }
}

