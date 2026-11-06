import { fail, isResponse, json, requireAuth } from "@/lib/api";
import { ownIds } from "@/lib/clinic/family";
import { listAppts } from "@/lib/clinic/appointments";
import { blocker, isLive, listPromos, markViewed } from "@/lib/clinic/promos";
import { getTariffs } from "@/lib/clinic/billing";

/** Live promos the signed-in patient (or their family) can still use. */
export async function GET() {
  const a = await requireAuth();
  if (isResponse(a)) return a;
  if (a.user.role !== "pasien") return fail("forbidden", 403);
  const ids = await ownIds(a.user.id);
  const self = ids[0];
  const returning = self ? (await listAppts({ patientId: self })).some((x) => x.status === "selesai") : false;
  const tariffs = new Map((await getTariffs()).map((t) => [t.id, t.name]));
  const out = [];
  for (const p of (await listPromos()).filter((x) => isLive(x))) {
    if (self && (await blocker(p, self, returning, p.doctorId, p.poliklinikId))) continue;
    if (self) await markViewed(p.id, self);
    out.push({ id: p.id, name: p.name, desc: p.desc, kind: p.kind, value: p.value, end: p.end, code: p.code ?? null, tariffs: p.tariffIds.map((t) => tariffs.get(t)).filter(Boolean), doctorId: p.doctorId ?? null });
  }
  return json({ ok: true, promos: out });
}
