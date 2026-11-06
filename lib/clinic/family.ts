import "server-only";
import { z } from "zod";
import { randomId } from "@/lib/auth/crypto";
import { db } from "@/lib/db/store";
import { getPatient, patientOfUser, savePatient, type Patient } from "./patients";

const fk = (uid: string) => `family:${uid}`;
export const dependentSchema = z.object({
  name: z.string().trim().min(2).max(80),
  relation: z.enum(["anak", "pasangan", "orang-tua", "saudara", "lainnya"]),
  gender: z.enum(["L", "P"]),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  allergies: z.string().trim().max(200).optional(),
});

/** The portal user's own patient record first, then dependents they manage. */
export async function ownPatients(uid: string): Promise<Patient[]> {
  const self = await patientOfUser(uid);
  const deps = (await Promise.all((await db().smembers(fk(uid))).map(getPatient))).filter(Boolean) as Patient[];
  return [...(self ? [self] : []), ...deps.sort((a, b) => a.createdAt - b.createdAt)];
}
export const ownIds = async (uid: string) => (await ownPatients(uid)).map((p) => p.id);
export const ownsPatient = async (uid: string, pid: string) => (await ownIds(uid)).includes(pid);

export async function addDependent(uid: string, d: z.infer<typeof dependentSchema>): Promise<Patient | null> {
  const self = await patientOfUser(uid);
  if (!self) return null;
  if ((await db().smembers(fk(uid))).length >= 8) return null;
  const p: Patient = {
    id: randomId(), name: d.name, phone: self.phone, email: self.email, gender: d.gender, birthDate: d.birthDate, birthPlace: "-",
    idType: "wni", idMasked: "-", idEnc: "", address: self.address, health: { allergies: d.allergies ?? "" },
    emergency: { name: self.name, relation: d.relation, phone: self.phone }, status: "belum_terverifikasi", duplicateOf: null,
    createdAt: Date.now(), createdBy: uid, guardianUserId: uid, relation: d.relation,
  };
  await savePatient(p);
  await db().sadd("patients:all", p.id);
  await db().sadd(fk(uid), p.id);
  return p;
}
export async function removeDependent(uid: string, pid: string) {
  const p = await getPatient(pid);
  if (!p || p.guardianUserId !== uid) return false;
  await db().srem(fk(uid), pid);
  return true;
}
