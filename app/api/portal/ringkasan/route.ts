import { fail, isResponse, json, requireAuth } from "@/lib/api";
import { ACTIVE, listAppts } from "@/lib/clinic/appointments";
import { due, listInvoices } from "@/lib/clinic/billing";
import { consentsOfPatient } from "@/lib/clinic/care";
import { surveyDone } from "@/lib/clinic/engage";
import { ownIds, ownPatients } from "@/lib/clinic/family";
import { getPromo, isLive, listPromos } from "@/lib/clinic/promos";
import { present } from "@/lib/clinic/present";
import { todayWita } from "@/lib/clinic/time";
import { visitsOfPatient } from "@/lib/clinic/visits";
import { inbox } from "@/lib/push";

/** Everything the patient home screen needs, read from the live store in one call. */
export async function GET() {
  const a = await requireAuth();
  if (isResponse(a)) return a;
  if (a.user.role !== "pasien") return fail("forbidden", 403);
  const members = await ownPatients(a.user.id);
  const items = await inbox(a.user.id);
  const p = members[0];
  if (!p) return json({ ok: true, patient: null, items });
  const ids = await ownIds(a.user.id);
  const today = todayWita();
  const all = (await Promise.all(ids.map((id) => listAppts({ patientId: id })))).flat();
  const next = all.filter((x) => ACTIVE.includes(x.status) && x.date >= today).sort((x, y) => (x.date + x.time).localeCompare(y.date + y.time));
  const bills = (await Promise.all(ids.map((id) => listInvoices({ patientId: id })))).flat().filter((i) => i.status !== "batal");
  const visits = (await Promise.all(ids.map((id) => visitsOfPatient(id)))).flat().filter((v) => v.status === "selesai").sort((x, y) => y.date.localeCompare(x.date));
  const n = next[0] ? (await present([next[0]]))[0] : null;
  // Queue position for today's checked-in appointment: people of the same doctor with a lower number still waiting.
  const live = next.find((x) => x.date === today && ["checkin", "dipanggil"].includes(x.status));
  let queue = null;
  if (live) {
    const wait = (await listAppts({ date: today, doctorId: live.doctorId, status: ["checkin"] })).filter((x) => x.queueNo && x.queueNo < (live.queueNo ?? 0)).length;
    queue = { no: live.queueNo ?? null, ahead: live.status === "dipanggil" ? 0 : wait, status: live.status };
  }
  const arrivable = next.find((x) => x.date === today && x.status === "dikonfirmasi");
  const promoCount = (await listPromos()).filter((x) => isLive(x)).length;
  void getPromo;
  const pendingConsent = (await Promise.all(ids.map(consentsOfPatient))).flat().filter((c) => c.status === "menunggu").length;
  let pendingSurvey = 0;
  for (const v of visits.slice(0, 5)) if (!(await surveyDone(v.id))) pendingSurvey++;
  return json({
    ok: true,
    patient: { name: p.name, rmNo: p.rmNo ?? null, status: p.status },
    next: n ? { id: n.id, date: n.date, time: n.time, doctorName: n.doctorName, patientName: n.patientName, status: n.status, queueNo: n.queueNo ?? null } : null,
    arrivable: arrivable ? { id: arrivable.id, time: arrivable.time } : null,
    queue, promoCount, pending: { consent: pendingConsent, survey: pendingSurvey }, family: members.length - 1,
    upcoming: next.length,
    dueTotal: bills.reduce((s, i) => s + due(i), 0),
    unpaid: bills.filter((i) => due(i) > 0).length,
    visitCount: visits.length,
    lastVisit: visits[0]?.date ?? null,
    items: items.slice(0, 5),
  });
}
