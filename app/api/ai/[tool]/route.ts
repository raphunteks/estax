import { z } from "zod";
import { fail, isResponse, json, requireAuth } from "@/lib/api";
import { audit, rateLimit } from "@/lib/auth/guards";
import { AiError, aiReady, aiTransport } from "@/lib/ai";
import { TOOLS, aftercare, answerFaq, answerReport, patientContext, soapFromText, summarize, tidyNote, waReply, voiceConverse, type FaqTurn, type VoiceTurn, type Tool } from "@/lib/clinic/ai-tools";
import { analytics } from "@/lib/clinic/analytics";
import { getPatient } from "@/lib/clinic/patients";
import { getVisit } from "@/lib/clinic/visits";
import { redact } from "@/lib/ai-redact";

const text = (n: number) => z.string().trim().min(2).max(n);
const body = {
  soap: z.object({ text: text(4000), patientId: z.string().max(40).optional() }),
  tidy: z.object({ text: text(4000), patientId: z.string().max(40).optional() }),
  summary: z.object({ patientId: z.string().max(40), reason: z.string().trim().max(200).optional() }),
  wa: z.object({ message: text(1000) }),
  report: z.object({ question: text(400), days: z.union([z.literal(7), z.literal(30), z.literal(90)]).default(30) }),
  faq: z.object({ question: text(500), history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().max(800) })).max(8).default([]) }),
  edu: z.object({ visitId: z.string().max(40), reason: z.string().trim().max(200).optional() }),
  voice: z.object({ question: text(1500), history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().max(2500) })).max(12).default([]) }),
} as const;

const ERR: Record<string, [number, string]> = {
  ai_not_configured: [503, "AI belum dikonfigurasi."],
  insecure_transport: [503, "Endpoint AI belum memakai HTTPS."],
  ai_unreachable: [502, "Server aplikasi tidak bisa menghubungi 9Router. Periksa NINEROUTER_BASE_URL dan pastikan 9Router menyala."],
  ai_401: [502, "9Router menolak kunci API. Periksa NINEROUTER_API_KEY."],
  ai_403: [502, "9Router menolak kunci API. Periksa NINEROUTER_API_KEY."],
  ai_404: [502, "Model chat tidak ditemukan di 9Router. Isi NINEROUTER_MODEL dengan nama combo/model yang ada."],
  ai_400: [502, "9Router menolak permintaan (model tidak valid?). Periksa NINEROUTER_MODEL."],
  ai_429: [429, "Kuota atau batas laju 9Router tercapai. Coba lagi sebentar."],
};

export async function POST(req: Request, { params }: { params: Promise<{ tool: string }> }) {
  const tool = (await params).tool as Tool;
  if (!(tool in body)) return fail("not_found", 404);
  const a = await requireAuth();
  if (isResponse(a)) return a;
  if (!TOOLS[a.user.role].includes(tool)) return fail("forbidden", 403);
  const p = body[tool].safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("validation", 400, p.error.issues[0]?.message);
  if (!aiReady) return fail("ai_not_configured", 503, ERR.ai_not_configured[1]);
  const tr = aiTransport();
  if (!tr.ok) return fail("insecure_transport", 503, tr.message);
  if (!(await rateLimit("ai", a.user.id, ["faq", "voice"].includes(tool) ? 60 : 40, 3600))) return fail("rate_limited", 429, "Terlalu banyak permintaan AI. Coba lagi nanti.");
  const d = p.data as Record<string, unknown>;
  try {
    const names = async () => { const pt = d.patientId ? await getPatient(String(d.patientId)) : null; return pt ? [pt.name] : []; };
    let result: unknown;
    if (tool === "soap") { result = { soap: await soapFromText(String(d.text), await names()) }; if (!(result as { soap: unknown }).soap) return fail("ai_bad_output", 502, "Hasil AI tidak bisa dibaca. Coba lagi."); }
    else if (tool === "edu") {
      const v = await getVisit(String(d.visitId));
      if (!v) return fail("not_found", 404);
      if (a.user.role === "dokter" && v.doctorId !== a.user.id) return fail("forbidden", 403);
      if (a.user.role === "superadmin") { if (String(d.reason ?? "").length < 5) return fail("reason_required", 400, "Superadmin wajib mengisi alasan akses."); await audit("ai.edu.access", a.user.id, { visit: v.id, reason: d.reason }); }
      const pt = await getPatient(v.patientId);
      const r = (x?: string) => redact(x ?? "", pt ? [pt.name] : []);
      const ctx = [`Tindakan hari ini: ${v.procedures.map((x) => `${r(x.name)}${x.tooth ? ` gigi ${x.tooth}` : ""}`).join("; ") || "-"}`, `Rencana lanjutan: ${v.plan.filter((x) => x.status === "rencana").map((x) => `${r(x.text)}${x.tooth ? ` gigi ${x.tooth}` : ""}`).join("; ") || "-"}`, `Resep: ${v.rx.map((x) => `${r(x.drug)} ${r(x.dose)} ${r(x.freq)} ${r(x.days)} hari`).join("; ") || "-"}`, `Catatan Plan: ${r(v.soap.p)}`].join("\n");
      result = { text: await aftercare(ctx) };
    } else if (tool === "tidy") result = { text: await tidyNote(String(d.text), await names()) };
    else if (tool === "summary") {
      const pt = await getPatient(String(d.patientId));
      if (!pt) return fail("not_found", 404);
      if (a.user.role === "superadmin" && String(d.reason ?? "").length < 5) return fail("reason_required", 400, "Superadmin wajib mengisi alasan akses.");
      await audit("ai.summary.access", a.user.id, { patient: pt.id, reason: d.reason });
      result = { text: await summarize(await patientContext(pt)) };
    } else if (tool === "wa") result = { text: await waReply(String(d.message)) };
    else if (tool === "report") result = { text: await answerReport(String(d.question), await analytics({ id: a.user.id, role: a.user.role }, Number(d.days))) };
    else if (tool === "voice") {
      const text = await voiceConverse(String(d.question), d.history as VoiceTurn[]);
      if (!text) return fail("ai_empty", 502, "Asisten belum bisa menjawab. Coba ulangi ucapan Anda.");
      result = { text };
    } else {
      const text = await answerFaq(String(d.question), d.history as FaqTurn[]);
      if (!text) return fail("ai_empty", 502, "Asisten belum bisa menjawab. Coba tanyakan dengan kalimat lain.");
      result = { text };
    }
    await audit(`ai.${tool}`, a.user.id, { chars: JSON.stringify(d).length });
    return json({ ok: true, draft: true, ...(result as object) });
  } catch (e) {
    const code = e instanceof AiError ? e.code : "ai_error";
    await audit(`ai.${tool}.failed`, a.user.id, { code });
    const [s, m] = ERR[code] ?? [502, "AI gagal menjawab. Coba lagi."];
    return fail(code, s, m);
  }
}
