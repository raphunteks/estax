import "server-only";
import { getUser } from "@/lib/auth/users";
import { db } from "@/lib/db/store";
import { listAppts } from "./appointments";
import type { Patient } from "./patients";
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

const at = (a: { recallAt?: number; calledAt?: number }) => a.recallAt ?? a.calledAt ?? 0;

/** Waiting-room screens are public-facing: names are masked and only queue numbers and doctors are shown. */
export async function poliBoard(): Promise<PoliBoard> {
  const date = todayWita();
  const all = (await listAppts({ date })).filter((a) => a.queueNo && ["checkin", "dipanggil", "dikursi", "selesai"].includes(a.status));
  const rows = all.filter((a) => a.status !== "selesai");
  const byDoc = new Map<string, typeof rows>();
  for (const a of rows) byDoc.set(a.doctorId, [...(byDoc.get(a.doctorId) ?? []), a]);

  const allDocIds = [...new Set(all.map((a) => a.doctorId))];
  const allPids = [...new Set(all.map((a) => a.patientId))];
  const [docUsers, patientRows] = await Promise.all([
    Promise.all(allDocIds.map((id) => getUser(id))),
    allPids.length ? db().mget<Patient>(...allPids.map((id) => `patient:${id}`)) : Promise.resolve([]),
  ]);
  const docName = new Map(allDocIds.map((id, i) => [id, docUsers[i]?.name ?? "Dokter"]));
  const pName = new Map(allPids.map((id, i) => [id, maskName(patientRows[i]?.name ?? "Pasien")]));
  const shown = (pid: string) => pName.get(pid) ?? maskName("Pasien");

  const doctors: PoliBoard["doctors"] = [];
  let last: PoliBoard["last"] = null;
  const lastOf = (id: string) => all.filter((a) => a.doctorId === id && a.calledAt).sort((a, b) => at(b) - at(a))[0];
  for (const [id, list] of byDoc) {
    const doc = docName.get(id) ?? "Dokter";
    const called = list.filter((a) => a.status === "dipanggil").sort((a, b) => at(b) - at(a));
    const chair = list.filter((a) => a.status === "dikursi").sort((a, b) => (b.seatedAt ?? 0) - (a.seatedAt ?? 0))[0];
    const wait = list.filter((a) => a.status === "checkin").sort((a, b) => a.queueNo! - b.queueNo!);
    const c = called[0];
    doctors.push({
      id, name: doc,
      calling: c ? { no: c.queueNo!, name: shown(c.patientId), at: at(c) } : null,
      inChair: chair ? { no: chair.queueNo!, name: shown(chair.patientId) } : null,
      waiting: wait.slice(0, 6).map((a) => ({ no: a.queueNo!, name: shown(a.patientId) })),
      waitingCount: wait.length,
    });
    // The big number keeps the latest call of the day even after that patient sits down, until the next call replaces it.
    const lc = lastOf(id);
    if (lc && (!last || at(lc) > last.at)) last = { no: lc.queueNo!, name: shown(lc.patientId), doctor: doc, at: at(lc) };
  }
  for (const id of allDocIds) {
    if (byDoc.has(id)) continue;
    const lc = lastOf(id);
    if (lc && (!last || at(lc) > last.at)) last = { no: lc.queueNo!, name: shown(lc.patientId), doctor: docName.get(id) ?? "Dokter", at: at(lc) };
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
  const lc = today.filter((r) => r.calledAt).sort((a, b) => at(b) - at(a))[0];

  const pids = [...new Set(today.map((r) => r.patientId))];
  const patientRows = pids.length ? await db().mget<Patient>(...pids.map((id) => `patient:${id}`)) : [];
  const pName = new Map(pids.map((id, i) => [id, maskName(patientRows[i]?.name ?? "Pasien")]));
  const line = (r: (typeof today)[number]) => ({ no: num.get(r.visitId)!, name: pName.get(r.patientId) ?? maskName("Pasien") });

  return {
    serverTime: Date.now(), date,
    last: lc ? { ...line(lc), at: at(lc) } : null,
    calling: called.slice(0, 4).map((r) => ({ ...line(r), at: at(r) })),
    waiting: waiting.filter((r) => !r.calledAt).slice(0, 8).map(line),
    waitingCount: waiting.filter((r) => !r.calledAt).length,
    ready: today.filter((r) => r.status === "selesai").length,
  };
}
