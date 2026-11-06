import "server-only";
import { randomId } from "@/lib/auth/crypto";
import { db } from "@/lib/db/store";
import { getMaster } from "@/lib/master";
import { pushPatient } from "./appointments";
import { addDays, todayWita } from "./time";
import { getVisit, saveVisit, type Visit } from "./visits";
import { getPatient } from "./patients";

/* ---------- digital informed consent ---------- */
export type Consent = {
  id: string; visitId: string; patientId: string; doctorId: string; tplId: string; title: string; body: string;
  status: "menunggu" | "ditandatangani" | "ditolak"; createdAt: number; signedAt?: number; signature?: string; signerName?: string; ip?: string;
};
const ck = (id: string) => `consent:${id}`;
export const getConsent = (id: string) => db().get<Consent>(ck(id));
export const saveConsent = (c: Consent) => db().set(ck(c.id), c);
export async function requestConsent(visit: Visit, tplId: string, doctorName: string): Promise<Consent | null> {
  const tpl = (await getMaster("consent")).find((t) => t.id === tplId && t.active);
  if (!tpl) return null;
  const c: Consent = { id: randomId().slice(0, 12), visitId: visit.id, patientId: visit.patientId, doctorId: visit.doctorId, tplId, title: tpl.title, body: tpl.body, status: "menunggu", createdAt: Date.now() };
  await saveConsent(c);
  await db().sadd(`consent:v:${visit.id}`, c.id);
  await db().sadd(`consent:p:${visit.patientId}`, c.id);
  await pushPatient(visit.patientId, "Persetujuan tindakan", `${doctorName} meminta persetujuan: ${tpl.title}.`, "/portal/persetujuan");
  return c;
}
const load = async (ids: string[]) => ((await Promise.all(ids.map(getConsent))).filter(Boolean) as Consent[]).sort((a, b) => b.createdAt - a.createdAt);
export const consentsOfVisit = async (visitId: string) => load(await db().smembers(`consent:v:${visitId}`));
export const consentsOfPatient = async (patientId: string) => load(await db().smembers(`consent:p:${patientId}`));

/* ---------- post-treatment education ---------- */
export type EduItem = { id: string; title: string; body: string; visitId: string; t: number };
const ek = (pid: string) => `edu:p:${pid}`;
export const eduOfPatient = (patientId: string) => db().lrange<EduItem>(ek(patientId), 0, 49);
export async function sendEdu(patientId: string, visitId: string, art: { id: string; title: string; body: string }): Promise<boolean> {
  if (!(await db().set(`edu:sent:${visitId}:${art.id}`, 1, { nx: true }))) return false;
  await db().lpush(ek(patientId), { id: art.id, title: art.title, body: art.body, visitId, t: Date.now() } satisfies EduItem);
  await pushPatient(patientId, "Panduan perawatan", art.title, "/portal/edukasi");
  return true;
}
/** Sends every active article whose keywords appear in a procedure name of the finished visit. */
export async function autoEdu(v: Visit) {
  const names = v.procedures.map((p) => p.name.toLowerCase()).join(" | ");
  if (!names) return 0;
  let n = 0;
  for (const a of (await getMaster("edu")).filter((x) => x.active)) {
    const keys = a.keywords.split(",").map((k) => k.trim().toLowerCase()).filter(Boolean);
    if (keys.some((k) => names.includes(k)) && (await sendEdu(v.patientId, v.id, a))) n++;
  }
  return n;
}

/* ---------- recall (follow-up) ---------- */
export const recallDate = (visitDate: string, days: number) => addDays(visitDate, days);
export async function indexRecall(visitId: string) { await db().sadd("recall:idx", visitId); }
export type RecallRow = { visitId: string; patientId: string; patientName: string; rmNo: string | null; doctorId: string; name: string; date: string; note?: string; remindedAt?: number; overdue: boolean };
/** Open recalls: the patient has no active appointment on/after the recall window start. */
export async function openRecalls(doctorId?: string): Promise<RecallRow[]> {
  const out: RecallRow[] = [];
  const today = todayWita();
  const { listAppts, ACTIVE } = await import("./appointments");
  for (const id of await db().smembers("recall:idx")) {
    const v = await getVisit(id);
    if (!v?.recall || (doctorId && v.doctorId !== doctorId)) continue;
    const appts = await listAppts({ patientId: v.patientId });
    const later = appts.some((a) => a.id !== v.apptId && a.date >= today && ACTIVE.includes(a.status)) || appts.some((a) => a.id !== v.apptId && a.date > v.date && a.status === "selesai");
    if (later) continue;
    const p = await getPatient(v.patientId);
    out.push({ visitId: v.id, patientId: v.patientId, patientName: p?.name ?? "-", rmNo: p?.rmNo ?? null, doctorId: v.doctorId, name: v.recall.name, date: v.recall.date, note: v.recall.note, remindedAt: v.recall.remindedAt, overdue: v.recall.date < today });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
export async function remindRecall(visitId: string): Promise<boolean> {
  const v = await getVisit(visitId);
  if (!v?.recall) return false;
  await pushPatient(v.patientId, "Waktunya kontrol", `${v.recall.name} dijadwalkan sekitar ${v.recall.date}. Buat janji sekarang.`, "/portal/janji");
  v.recall.remindedAt = Date.now();
  await saveVisit(v);
  return true;
}
/** Cron step: remind patients whose recall date is within the configured lead time (once each). */
export async function runRecallReminders() {
  const lead = (await getMaster("features")).recallRemindDays;
  const until = addDays(todayWita(), lead);
  let sent = 0;
  for (const r of await openRecalls()) if (!r.remindedAt && r.date <= until && (await remindRecall(r.visitId))) sent++;
  return sent;
}
