import "server-only";
import { getMaster } from "@/lib/master";
import type { Role } from "@/lib/auth/rbac";
import { ACTIVE, listAppts } from "./appointments";
import { listPatients } from "./patients";
import { addDays, todayWita } from "./time";

/** Real numbers only: everything is computed from stored appointments and patients. */
export async function getStats(user: { id: string; role: Role }) {
  const today = todayWita();
  const from = addDays(today, -29);
  const doctorId = user.role === "dokter" ? user.id : undefined;
  const [rows, rules, polis] = await Promise.all([listAppts({ from, to: addDays(today, 0), doctorId }), getMaster("rules"), getMaster("poliklinik")]);
  const counted = rows.filter((a) => a.status !== "batal_pasien" && a.status !== "batal_klinik" && a.status !== "tidak_hadir");
  const todayRows = (await listAppts({ date: today, doctorId })).filter((a) => a.status !== "batal_pasien" && a.status !== "batal_klinik");
  if (user.role === "apoteker") return { limited: true as const, today: todayRows.length };

  const perDay = Array.from({ length: 30 }, (_, i) => {
    const date = addDays(from, i);
    return { date, label: date.slice(8) + "/" + date.slice(5, 7), visits: counted.filter((a) => a.date === date).length };
  });
  const polName = new Map(polis.map((p) => [p.id, p.name]));
  const byPoli = Object.entries(counted.reduce<Record<string, number>>((m, a) => ((m[polName.get(a.poliklinikId ?? "") ?? "Lainnya"] = (m[polName.get(a.poliklinikId ?? "") ?? "Lainnya"] ?? 0) + 1), m), {})).map(([name, total]) => ({ name, total }));
  const patients = user.role === "dokter" ? [] : await listPatients();
  const newIds = new Set(patients.filter((p) => p.createdAt >= Date.parse(`${from}T00:00:00+08:00`)).map((p) => p.id));
  const uniq = new Set(counted.map((a) => a.patientId));
  const fresh = [...uniq].filter((id) => newIds.has(id)).length;
  const month = today.slice(0, 7);
  const monthVisits = counted.filter((a) => a.date.startsWith(month)).length;
  const waits = todayRows.filter((a) => a.checkInAt && a.calledAt).map((a) => (a.calledAt! - a.checkInAt!) / 60000);
  return {
    limited: false as const,
    kpi: {
      today: todayRows.length,
      pending: (await listAppts({ status: ["menunggu"], doctorId })).length,
      waiting: todayRows.filter((a) => a.status === "checkin").length,
      inChair: todayRows.filter((a) => a.status === "dikursi" || a.status === "dipanggil").length,
      done: todayRows.filter((a) => a.status === "selesai").length,
      patients: user.role === "dokter" ? null : patients.length,
      avgWait: waits.length ? Math.round(waits.reduce((s, x) => s + x, 0) / waits.length) : null,
    },
    perDay,
    byPoli,
    mix: [{ name: "Pasien baru", total: fresh }, { name: "Pasien lama", total: Math.max(uniq.size - fresh, 0) }],
    target: { value: monthVisits, goal: rules.monthlyTarget, month },
    activeStates: ACTIVE.length,
  };
}
export type Stats = Exclude<Awaited<ReturnType<typeof getStats>>, { limited: true }>;
