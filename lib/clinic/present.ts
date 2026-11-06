import "server-only";
import { getUser } from "@/lib/auth/users";
import type { Appt } from "./appointments";
import { getPatient } from "./patients";

/** Adds patient and doctor names (never the full ID number) so screens need no extra lookups. */
export async function present(list: Appt[]) {
  const pc = new Map<string, Awaited<ReturnType<typeof getPatient>>>();
  const dc = new Map<string, string>();
  return Promise.all(
    list.map(async (a) => {
      if (!pc.has(a.patientId)) pc.set(a.patientId, await getPatient(a.patientId));
      if (!dc.has(a.doctorId)) dc.set(a.doctorId, (await getUser(a.doctorId))?.name ?? "-");
      const p = pc.get(a.patientId);
      return { ...a, patientName: p?.name ?? "-", rmNo: p?.rmNo ?? null, patientPhone: p?.phone, doctorName: dc.get(a.doctorId)! };
    }),
  );
}
