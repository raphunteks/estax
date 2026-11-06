import "server-only";
import { getUser } from "@/lib/auth/users";
import { listAppts } from "./appointments";
import { getPatient } from "./patients";
import { listRx } from "./pharmacy";
import { maskName } from "./public-booking";
import { todayWita } from "./time";

export const MONITOR_ROLES = ["superadmin", "dokter", "staf", "apoteker"];

type Line = { no: number; name: string };
export type PoliBoard = {
  serverTime: number; date: string;
  /** Latest call anywhere in the clinic; `at` changes on every call or repeat so screens can react once. */
  last: { no: number; name: string; doctor: string; at: number } | null;
  doctors: { id: string; name: string; calling: (Line & { at: number }) | null; inChair: Line | null; waiting: Line[]; waitingCount: number }[];
};
export type FarmasiBoard = {
  serverTime: number; date: string;
  last: { no: number; name: string; at: number } | null;
  calling: (Line & { at: number })[]; waiting: Line[]; waitingCount: number; ready: number;
};

const names = new Map<string, string>();
async function shown(patientId: string) {
  if (!names.has(patientId)) names.set(patientId, maskName((await getPatient(patientId))?.name ?? "Pasien"));
  return names.get(patientId)!;
}
const at = (a: { recallAt?: number; calledAt?: number }) => a.recallAt ?? a.calledAt ?? 0;

/** Waiting-room screens are public-facing: names are masked and only queue numbers and doctors are shown. */
export async function poliBoard(): Promise<PoliBoard> {
  const date = todayWita();
  const all = (await listAppts({ date })).filter((a) => a.queueNo && ["checkin", "dipanggil", "dikursi", "selesai"].includes(a.status));
  const rows = all.filter((a) => a.status !== "selesai");
  const byDoc = new Map<string, typeof rows>();
  for (const a of rows) byDoc.set(a.doctorId, [...(byDoc.get(a.doctorId) ?? []), a]);
  const doctors: PoliBoard["doctors"] = [];
  let last: PoliBoard["last"] = null;
  const lastOf = (id: string) => all.filter((a) => a.doctorId === id && a.calledAt).sort((a, b) => at(b) - at(a))[0];
  for (const [id, list] of byDoc) {
    const doc = (await getUser(id))?.name ?? "Dokter";
    const called = list.filter((a) => a.status === "dipanggil").sort((a, b) => at(b) - at(a));
    const chair = list.filter((a) => a.status === "dikursi").sort((a, b) => (b.seatedAt ?? 0) - (a.seatedAt ?? 0))[0];
    const wait = list.filter((a) => a.status === "checkin").sort((a, b) => a.queueNo! - b.queueNo!);
    const c = called[0];
    doctors.push({
      id, name: doc,
      calling: c ? { no: c.queueNo!, name: await shown(c.patientId), at: at(c) } : null,
      inChair: chair ? { no: chair.queueNo!, name: await shown(chair.patientId) } : null,
      waiting: await Promise.all(wait.slice(0, 6).map(async (a) => ({ no: a.queueNo!, name: await shown(a.patientId) }))),
      waitingCount: wait.length,
    });
    // The big number keeps the latest call of the day even after that patient sits down, until the next call replaces it.
    const lc = lastOf(id);
    if (lc && (!last || at(lc) > last.at)) last = { no: lc.queueNo!, name: await shown(lc.patientId), doctor: doc, at: at(lc) };
  }
  for (const id of new Set(all.map((a) => a.doctorId))) {
    if (byDoc.has(id)) continue;
    const lc = lastOf(id);
    if (lc && (!last || at(lc) > last.at)) last = { no: lc.queueNo!, name: await shown(lc.patientId), doctor: (await getUser(id))?.name ?? "Dokter", at: at(lc) };
  }
  doctors.sort((a, b) => a.name.localeCompare(b.name));
  return { serverTime: Date.now(), date, last, doctors };
}

export async function farmasiBoard(): Promise<FarmasiBoard> {
  const date = todayWita();
  const today = (await listRx()).filter((r) => r.date === date).sort((a, b) => a.createdAt - b.createdAt);
  const num = new Map(today.map((r, i) => [r.visitId, i + 1]));
  const waiting = today.filter((r) => r.status === "menunggu");
  const called = waiting.filter((r) => r.calledAt).sort((a, b) => at(b) - at(a));
  const line = async (r: (typeof today)[number]) => ({ no: num.get(r.visitId)!, name: await shown(r.patientId) });
  const lc = today.filter((r) => r.calledAt).sort((a, b) => at(b) - at(a))[0];
  return {
    serverTime: Date.now(), date,
    last: lc ? { ...(await line(lc)), at: at(lc) } : null,
    calling: await Promise.all(called.slice(0, 4).map(async (r) => ({ ...(await line(r)), at: at(r) }))),
    waiting: await Promise.all(waiting.filter((r) => !r.calledAt).slice(0, 8).map(line)),
    waitingCount: waiting.filter((r) => !r.calledAt).length,
    ready: today.filter((r) => r.status === "selesai").length,
  };
}
