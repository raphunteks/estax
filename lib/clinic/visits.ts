import { z } from "zod";
import { db } from "@/lib/db/store";
import { randomId as newId } from "@/lib/auth/crypto";
import { type Appt } from "@/lib/clinic/appointments";
import { emptyOdo, odoSchema, type Odo } from "@/lib/clinic/odontogram";

const t = (n: number) => z.string().trim().max(n);
export const anamnesisSchema = z.object({ complaint: t(500), history: t(1000), allergies: t(300), medications: t(300), conditions: t(300) }).partial();
export const vitalsSchema = z.object({ bp: t(12), pulse: t(6), temp: t(6), weight: t(6), spo2: t(5) }).partial();
export const soapSchema = z.object({ s: t(2000), o: t(2000), a: t(2000), p: t(2000) }).partial();
const tooth = t(3).optional();
export const planSchema = z.array(z.object({ id: z.string().max(40), text: t(300), tooth, status: z.enum(["rencana", "selesai"]) })).max(40);
export const procSchema = z.array(z.object({ id: z.string().max(40), name: t(200), tooth, note: t(300).optional() })).max(60);
export const dxSchema = z.array(z.object({ code: t(8), title: t(200), primary: z.boolean().optional() })).max(10);
export const rxSchema = z.array(z.object({ id: z.string().max(40), drug: t(120), dose: t(60), freq: t(60), days: t(10), note: t(200).optional() })).max(30);

export type Visit = {
  id: string; patientId: string; apptId: string; doctorId: string; date: string; status: "berjalan" | "selesai";
  anamnesis: z.infer<typeof anamnesisSchema>; vitals: z.infer<typeof vitalsSchema>; soap: z.infer<typeof soapSchema>;
  diagnoses?: z.infer<typeof dxSchema>; plan: z.infer<typeof planSchema>; procedures: z.infer<typeof procSchema>; rx: z.infer<typeof rxSchema>;
  odo: Odo; createdAt: number; updatedAt: number; finishedAt?: number;
};

const vkey = (id: string) => `visit:${id}`;
export const getVisit = (id: string) => db().get<Visit>(vkey(id));
export const saveVisit = (v: Visit) => db().set(vkey(v.id), { ...v, updatedAt: Date.now() });
export const visitOfAppt = (apptId: string) => db().get<string>(`visit:appt:${apptId}`);

/** Idempotent: one visit per appointment. */
export async function startVisit(a: Appt): Promise<Visit> {
  const existing = await visitOfAppt(a.id);
  if (existing) {
    const v = await getVisit(existing);
    if (v) return v;
  }
  // Carry the latest odontogram forward so the doctor edits from the last known state.
  const prev = (await visitsOfPatient(a.patientId)).filter((x) => x.status === "selesai").sort((x, y) => y.createdAt - x.createdAt)[0];
  const v: Visit = {
    id: newId(), patientId: a.patientId, apptId: a.id, doctorId: a.doctorId, date: a.date, status: "berjalan",
    anamnesis: { complaint: a.complaint ?? "" }, vitals: {}, soap: {}, plan: [], procedures: [], rx: [],
    odo: prev ? structuredClone(prev.odo) : emptyOdo(), createdAt: Date.now(), updatedAt: Date.now(),
  };
  if (!(await db().set(`visit:appt:${a.id}`, v.id, { nx: true }))) return (await getVisit((await visitOfAppt(a.id))!))!;
  await saveVisit(v);
  await db().sadd(`visits:p:${a.patientId}`, v.id);
  return v;
}

export async function visitsOfPatient(patientId: string): Promise<Visit[]> {
  const ids = await db().smembers(`visits:p:${patientId}`);
  const vs = await Promise.all(ids.map(getVisit));
  return (vs.filter(Boolean) as Visit[]).sort((a, b) => b.createdAt - a.createdAt);
}

/** Append-only odontogram history (newest first). */
export async function logOdo(v: Visit, by: string) {
  await db().lpush(`odo:${v.id}:log`, { t: Date.now(), by, odo: v.odo });
}
export const odoLog = (visitId: string) => db().lrange<{ t: number; by: string; odo: Odo }>(`odo:${visitId}:log`, 0, 49);
export { odoSchema };
