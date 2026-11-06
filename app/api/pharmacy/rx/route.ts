import { isResponse, json, requirePerm } from "@/lib/api";
import { listRx } from "@/lib/clinic/pharmacy";
import { getPatient } from "@/lib/clinic/patients";

export async function GET(req: Request) {
  const a = await requirePerm("pharmacy:dispense");
  if (isResponse(a)) return a;
  const s = new URL(req.url).searchParams.get("status");
  const want = s === "selesai" ? "selesai" : "menunggu";
  const all = await listRx();
  // Counter number = order of arrival among that day's prescriptions (same rule as the waiting-room screen).
  const no = new Map<string, number>();
  const seen = new Map<string, number>();
  for (const r of [...all].sort((x, y) => x.createdAt - y.createdAt)) { const n = (seen.get(r.date) ?? 0) + 1; seen.set(r.date, n); no.set(r.visitId, n); }
  const rx = all.filter((r) => r.status === want);
  const out = [];
  for (const r of rx) { const p = await getPatient(r.patientId); out.push({ visitId: r.visitId, date: r.date, status: r.status, patientName: p?.name ?? "-", rmNo: p?.rmNo ?? null, lines: r.lines.length, no: no.get(r.visitId), called: Boolean(r.calledAt) }); }
  return json({ ok: true, rx: out });
}
