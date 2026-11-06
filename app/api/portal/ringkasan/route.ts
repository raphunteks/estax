import { fail, isResponse, json, requireAuth } from "@/lib/api";
import { ACTIVE, listAppts } from "@/lib/clinic/appointments";
import { due, listInvoices } from "@/lib/clinic/billing";
import { patientOfUser } from "@/lib/clinic/patients";
import { present } from "@/lib/clinic/present";
import { todayWita } from "@/lib/clinic/time";
import { visitsOfPatient } from "@/lib/clinic/visits";
import { inbox } from "@/lib/push";

/** Everything the patient home screen needs, read from the live store in one call. */
export async function GET() {
  const a = await requireAuth();
  if (isResponse(a)) return a;
  if (a.user.role !== "pasien") return fail("forbidden", 403);
  const p = await patientOfUser(a.user.id);
  const items = await inbox(a.user.id);
  if (!p) return json({ ok: true, patient: null, items });
  const today = todayWita();
  const next = (await listAppts({ patientId: p.id })).filter((x) => ACTIVE.includes(x.status) && x.date >= today).sort((x, y) => (x.date + x.time).localeCompare(y.date + y.time));
  const bills = (await listInvoices({ patientId: p.id })).filter((i) => i.status !== "batal");
  const visits = (await visitsOfPatient(p.id)).filter((v) => v.status === "selesai");
  const n = next[0] ? (await present([next[0]]))[0] : null;
  return json({
    ok: true,
    patient: { name: p.name, rmNo: p.rmNo ?? null, status: p.status },
    next: n ? { id: n.id, date: n.date, time: n.time, doctorName: n.doctorName, status: n.status, queueNo: n.queueNo ?? null } : null,
    upcoming: next.length,
    dueTotal: bills.reduce((s, i) => s + due(i), 0),
    unpaid: bills.filter((i) => due(i) > 0).length,
    visitCount: visits.length,
    lastVisit: visits[0]?.date ?? null,
    items: items.slice(0, 5),
  });
}
