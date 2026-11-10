import { fail, isResponse, json, requireAuth } from "@/lib/api";
import { ACTIVE, listAppts } from "@/lib/clinic/appointments";
import { due, listInvoices } from "@/lib/clinic/billing";
import { consentsOfPatient } from "@/lib/clinic/care";
import { ownPatients } from "@/lib/clinic/family";
import { isLive, listPromos } from "@/lib/clinic/promos";
import { present } from "@/lib/clinic/present";
import { todayWita } from "@/lib/clinic/time";
import { visitsOfPatient } from "@/lib/clinic/visits";
import { db } from "@/lib/db/store";
import { inbox } from "@/lib/push";

/** Everything the patient home screen needs, read from the live store in parallel waves. */
export async function GET() {
  const a = await requireAuth();
  if (isResponse(a)) return a;
  if (a.user.role !== "pasien") return fail("forbidden", 403);
  const [members, items, allPromos] = await Promise.all([
    ownPatients(a.user.id),
    inbox(a.user.id),
    listPromos(),
  ]);
  const p = members[0];
  if (!p) return json({ ok: true, patient: null, items });
  const ids = members.map((m) => m.id);
  const today = todayWita();
  const [apptsByP, billsByP, visitsByP, consentsByP] = await Promise.all([
    Promise.all(ids.map((id) => listAppts({ patientId: id }))),
    Promise.all(ids.map((id) => listInvoices({ patientId: id }))),
    Promise.all(ids.map((id) => visitsOfPatient(id))),
    Promise.all(ids.map(consentsOfPatient)),
  ]);
  const all = apptsByP.flat();
  const next = all.filter((x) => ACTIVE.includes(x.status) && x.date >= today).sort((x, y) => (x.date + x.time).localeCompare(y.date + y.time));
  const bills = billsByP.flat().filter((i) => i.status !== "batal");
  const visits = visitsByP.flat().filter((v) => v.status === "selesai").sort((x, y) => y.date.localeCompare(x.date));
  const live = next.find((x) => x.date === today && ["checkin", "dipanggil"].includes(x.status));
  const top5Visits = visits.slice(0, 5);

  const [presentedNext, liveDocWait, surveyFlags] = await Promise.all([
    next[0] ? present([next[0]]) : Promise.resolve([]),
    live ? listAppts({ date: today, doctorId: live.doctorId, status: ["checkin"] }) : Promise.resolve([]),
    top5Visits.length ? db().mget<unknown>(...top5Visits.map((v) => `survey:v:${v.id}`)) : Promise.resolve([]),
  ]);

  const n = presentedNext[0] ?? null;
  let queue = null;
  if (live) {
    const wait = liveDocWait.filter((x) => x.queueNo && x.queueNo < (live.queueNo ?? 0)).length;
    queue = { no: live.queueNo ?? null, ahead: live.status === "dipanggil" ? 0 : wait, status: live.status };
  }
  const arrivable = next.find((x) => x.date === today && x.status === "dikonfirmasi");
  const promoCount = allPromos.filter((x) => isLive(x)).length;
  const pendingConsent = consentsByP.flat().filter((c) => c.status === "menunggu").length;
  const pendingSurvey = surveyFlags.filter((f) => !f).length;
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
