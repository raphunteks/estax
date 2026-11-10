import "server-only";
import { getUser } from "@/lib/auth/users";
import { db } from "@/lib/db/store";
import type { Appt } from "./appointments";
import type { Patient } from "./patients";

/** Adds patient and doctor names (never the full ID number) so screens need no extra lookups. */
export async function present(list: Appt[]) {
  if (!list.length) return [];
  const pids = [...new Set(list.map((a) => a.patientId))];
  const dids = [...new Set(list.map((a) => a.doctorId))];
  const [patients, doctors] = await Promise.all([
    db().mget<Patient>(...pids.map((id) => `patient:${id}`)),
    Promise.all(dids.map((id) => getUser(id))),
  ]);
  const pc = new Map(pids.map((id, i) => [id, patients[i]]));
  const dc = new Map(dids.map((id, i) => [id, doctors[i]?.name ?? "-"]));
  return list.map((a) => {
    const p = pc.get(a.patientId);
    return { ...a, patientName: p?.name ?? "-", rmNo: p?.rmNo ?? null, patientPhone: p?.phone, doctorName: dc.get(a.doctorId) ?? "-" };
  });
}
