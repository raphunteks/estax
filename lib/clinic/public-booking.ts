import "server-only";
import { db } from "@/lib/db/store";
import { randomToken } from "@/lib/auth/crypto";
import { getPatient, idHash } from "@/lib/clinic/patients";

/** Name with only the first letter of each word visible ("Dewi Kasir" -> "D*** K****"). */
export const maskName = (n: string) => n.split(/\s+/).map((w) => w[0] + "*".repeat(Math.max(2, w.length - 1))).join(" ");

const TOK = (t: string) => `bk:tok:${t}`;
export async function issueToken(patientId: string) {
  const t = randomToken(16);
  await db().set(TOK(t), patientId, { ex: 900 });
  return t;
}
export const tokenPatient = (t: string) => db().get<string>(TOK(t));

/** Finds a patient by NIK (16 digits) or RM number and checks birth date and the last 4 digits of the phone. Same answer for every failure. */
export async function verifyPatient(ident: string, birthDate: string, phone4: string) {
  const d = ident.replace(/\D/g, "");
  const id = /^\d{16}$/.test(d) ? await db().get<string>(`pid:${idHash("wni", d)}`) : await db().get<string>(`patient:rm:${d.padStart(6, "0")}`);
  const p = id ? await getPatient(id) : null;
  if (!p || p.birthDate !== birthDate || p.phone.replace(/\D/g, "").slice(-4) !== phone4) return null;
  return p;
}
