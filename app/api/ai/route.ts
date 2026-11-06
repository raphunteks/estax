import { isResponse, json, requireAuth } from "@/lib/api";
import { aiReady, aiTransport, probe } from "@/lib/ai";
import { fail } from "@/lib/api";
import { soapFromText } from "@/lib/clinic/ai-tools";
import { TOOLS } from "@/lib/clinic/ai-tools";

export async function GET() {
  const a = await requireAuth();
  if (isResponse(a)) return a;
  const t = aiTransport();
  return json({ ok: true, ready: aiReady && t.ok, reason: !aiReady ? "AI belum dikonfigurasi." : t.ok ? null : t.message, tools: TOOLS[a.user.role] });
}

/** Superadmin diagnostic: checks the router answers chat and lists STT models. No clinical data is sent. */
export async function POST() {
  const a = await requireAuth();
  if (isResponse(a)) return a;
  if (a.user.role !== "superadmin") return fail("forbidden", 403);
  if (!aiReady) return json({ ok: true, steps: [{ step: "konfigurasi", ok: false, ms: 0, detail: "NINEROUTER_BASE_URL / NINEROUTER_API_KEY belum diisi" }] });
  const t = aiTransport();
  if (!t.ok) return json({ ok: true, steps: [{ step: "transport", ok: false, ms: 0, detail: t.message }] });
  const steps = await probe();
  try {
    const t0 = Date.now();
    const soap = await soapFromText("Pasien nyeri gigi 36 tiga hari, perkusi positif, rencana PSA.");
    steps.push({ step: "soap-format", ok: Boolean(soap), ms: Date.now() - t0, detail: soap ? "model membalas format SOAP yang terbaca" : "balasan model tidak terbaca sebagai SOAP (lihat log server)" });
  } catch (e) { steps.push({ step: "soap-format", ok: false, ms: 0, detail: e instanceof Error ? e.message : "error" }); }
  return json({ ok: true, steps });
}
