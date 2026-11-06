import "server-only";
import { encrypt, randomId, sha256 } from "@/lib/auth/crypto";
import { db } from "@/lib/db/store";
import { maskNik } from "@/lib/nik";

export type Patient = {
  id: string;
  userId?: string;
  name: string;
  email?: string;
  phone: string;
  gender: "L" | "P";
  birthDate: string;
  birthPlace: string;
  idType: "wni" | "wna";
  idMasked: string;
  idEnc: string;
  address: Record<string, string | undefined>;
  health: Record<string, unknown>;
  emergency: { name: string; relation: string; phone: string };
  status: "belum_terverifikasi" | "terverifikasi";
  rmNo?: string;
  duplicateOf?: string | null;
  createdAt: number;
  createdBy?: string;
  /** Dependent (child/relative) managed from a guardian's portal account. */
  guardianUserId?: string;
  relation?: string;
};
type Input = Record<string, unknown> & { idType: "wni" | "wna"; idNumber: string; name: string; phone: string; gender: "L" | "P"; birthDate: string; birthPlace: string };

const key = (id: string) => `patient:${id}`;
export const getPatient = (id: string) => db().get<Patient>(key(id));
export const savePatient = (p: Patient) => db().set(key(p.id), p);
export async function patientOfUser(uid: string) {
  const id = await db().get<string>(`patient:byuser:${uid}`);
  return id ? getPatient(id) : null;
}
export const idHash = (type: string, num: string) => sha256(`${type}:${num}`);
export const dupKey = (name: string, birth: string, phone: string) => `pdup:${sha256(`${name.trim().toLowerCase()}|${birth}|${phone}`)}`;

/** Returns the existing patient id if the same ID number or the same name+birth date+phone is already registered. */
export async function findDuplicate(i: Pick<Input, "idType" | "idNumber" | "name" | "birthDate" | "phone">) {
  return (await db().get<string>(`pid:${idHash(i.idType, i.idNumber)}`)) ?? (await db().get<string>(dupKey(i.name, i.birthDate, i.phone)));
}

export async function createPatient(i: Input, o: { userId?: string; createdBy?: string; verified?: boolean }): Promise<Patient> {
  const str = (k: string) => (typeof i[k] === "string" && i[k] ? (i[k] as string) : undefined);
  const dup = await findDuplicate(i);
  const p: Patient = {
    id: randomId(),
    userId: o.userId,
    name: i.name.trim(),
    email: str("email")?.toLowerCase(),
    phone: i.phone,
    gender: i.gender,
    birthDate: i.birthDate,
    birthPlace: i.birthPlace,
    idType: i.idType,
    idMasked: maskNik(i.idNumber),
    idEnc: encrypt(i.idNumber),
    address: Object.fromEntries(["province", "city", "district", "village", "rt", "rw", "postal", "address", "landmark"].map((k) => [k, str(k)])),
    health: Object.fromEntries(["occupation", "bloodType", "marital", "allergies", "conditions", "conditionsOther", "medications", "pregnant", "smoker"].map((k) => [k, i[k]])),
    emergency: { name: String(i.emName ?? ""), relation: String(i.emRelation ?? ""), phone: String(i.emPhone ?? "") },
    status: "belum_terverifikasi",
    duplicateOf: dup,
    createdAt: Date.now(),
    createdBy: o.createdBy,
  };
  await savePatient(p);
  await db().sadd("patients:all", p.id);
  if (!dup) {
    await db().set(`pid:${idHash(i.idType, i.idNumber)}`, p.id);
    await db().set(dupKey(i.name, i.birthDate, i.phone), p.id);
  }
  if (o.userId) await db().set(`patient:byuser:${o.userId}`, p.id);
  if (o.verified) await issueRm(p);
  return p;
}

/** Sequential medical record number, issued once after staff matched the ID card. */
export async function issueRm(p: Patient) {
  if (p.rmNo) return p;
  p.rmNo = String(await db().incr("rm:seq")).padStart(6, "0");
  p.status = "terverifikasi";
  await savePatient(p);
  await db().set(`patient:rm:${p.rmNo}`, p.id);
  return p;
}

export async function listPatients(): Promise<Patient[]> {
  const ids = await db().smembers("patients:all");
  return ((await Promise.all(ids.map(getPatient))).filter(Boolean) as Patient[]).sort((a, b) => b.createdAt - a.createdAt);
}

export async function searchPatients(q: string): Promise<Patient[]> {
  const all = await listPatients();
  const s = q.trim().toLowerCase();
  if (!s) return all.slice(0, 50);
  const digits = s.replace(/\D/g, "");
  let byId: string | null = null;
  if (/^\d{16}$/.test(digits)) byId = await db().get<string>(`pid:${idHash("wni", digits)}`);
  return all.filter((p) => p.id === byId || p.name.toLowerCase().includes(s) || (p.rmNo && p.rmNo.includes(digits || s)) || (digits.length >= 4 && p.phone.replace(/\D/g, "").includes(digits))).slice(0, 50);
}

export const summary = (p: Patient) => ({ id: p.id, name: p.name, rmNo: p.rmNo ?? null, status: p.status, phone: p.phone, gender: p.gender, birthDate: p.birthDate, idMasked: p.idMasked, hasAccount: Boolean(p.userId), duplicate: Boolean(p.duplicateOf), createdAt: p.createdAt });
