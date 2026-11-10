import "server-only";
import { db, memoByRev } from "@/lib/db/store";
import { getMaster } from "@/lib/master";
import type { Role } from "@/lib/auth/rbac";
import { ACTIVE, listAppts } from "./appointments";
import { listPatients } from "./patients";
import { addDays, todayWita } from "./time";

/** Real numbers only: everything is computed from stored appointments and patients, cached in RAM + Redis by sys:rev. */
export async function getStats(user: { id: string; role: Role }) {
  const today = todayWita();
  const doctorId = user.role === "dokter" ? user.id : undefined;
  return memoByRev(`stats:${user.role}:${doctorId ?? "all"}:${today}`, async (rev) => {
    const cacheKey = `cache:stats:${user.role}:${doctorId ?? "all"}:${rev}:${today}`;
    try {
      const cached = await db().get<Awaited<ReturnType<typeof computeStats>>>(cacheKey);
      if (cached) return cached;
    } catch {
      /* fallback to compute */
    }
    const data = await computeStats(user, today, doctorId);
    void db().set(cacheKey, data, { ex: 600 }).catch(() => null);
    return data;
  });
}

async function computeStats(user: { id: string; role: Role }, today: string, doctorId: string | undefined) {
  if (user.role === "apoteker") {
    const todayRows = (await listAppts({ date: today })).filter((a) => a.status !== "batal_pasien" && a.status !== "batal_klinik");
    return { limited: true as const, today: todayRows.length };
  }
  const from = addDays(today, -29);
  const [rows, rules, polis, patients, pendingRows] = await Promise.all([
    listAppts({ from, to: today, doctorId }),
    getMaster("rules"),
    getMaster("poliklinik"),
    user.role === "dokter" ? Promise.resolve([]) : listPatients(),
    listAppts({ status: ["menunggu"], doctorId }),
  ]);
  const counted = rows.filter((a) => a.status !== "batal_pasien" && a.status !== "batal_klinik" && a.status !== "tidak_hadir");
  const todayRows = rows.filter((a) => a.date === today && a.status !== "batal_pasien" && a.status !== "batal_klinik");

  const perDay = Array.from({ length: 30 }, (_, i) => {
    const date = addDays(from, i);
    return { date, label: date.slice(8) + "/" + date.slice(5, 7), visits: counted.filter((a) => a.date === date).length };
  });
  const polName = new Map(polis.map((p) => [p.id, p.name]));
  const byPoli = Object.entries(counted.reduce<Record<string, number>>((m, a) => ((m[polName.get(a.poliklinikId ?? "") ?? "Lainnya"] = (m[polName.get(a.poliklinikId ?? "") ?? "Lainnya"] ?? 0) + 1), m), {})).map(([name, total]) => ({ name, total }));
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
      pending: pendingRows.length,
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
