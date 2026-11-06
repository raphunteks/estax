import "server-only";
import { z } from "zod";
import { randomId } from "@/lib/auth/crypto";
import { db } from "@/lib/db/store";
import { notifyRole, notifyUser } from "@/lib/push";
import { getUser } from "@/lib/auth/users";
import { getPatient } from "./patients";

/* ---------- waiting list: patients who want a slot when one opens ---------- */
const wk = (doctorId: string, date: string) => `wl:${date}:${doctorId}`;
export const joinWaitlist = (doctorId: string, date: string, userId: string) => db().sadd(wk(doctorId, date), userId);
export const leaveWaitlist = (doctorId: string, date: string, userId: string) => db().srem(wk(doctorId, date), userId);
export const onWaitlist = async (doctorId: string, date: string, userId: string) => (await db().smembers(wk(doctorId, date))).includes(userId);
/** Called when a slot is freed. Every waiting patient gets one message per slot; first to book wins. */
export async function wakeWaitlist(doctorId: string, date: string, time: string) {
  const users = await db().smembers(wk(doctorId, date));
  if (!users.length) return;
  const doc = (await getUser(doctorId))?.name ?? "dokter";
  for (const uid of users) {
    if (!(await db().set(`wln:${doctorId}:${date}:${time}:${uid}`, 1, { nx: true, ex: 86400 }))) continue;
    await notifyUser(uid, { title: "Ada slot kosong", body: `${doc}, ${date} pukul ${time} WITA. Segera buat janji sebelum terisi.`, url: "/portal/janji" });
  }
}

/* ---------- satisfaction survey ---------- */
export const surveySchema = z.object({ visitId: z.string().min(6).max(60), rating: z.number().int().min(1).max(5), comment: z.string().trim().max(300).optional() });
export type Survey = { id: string; visitId: string; patientId: string; doctorId: string; rating: number; comment?: string; t: number };
export async function saveSurvey(s: Omit<Survey, "id" | "t">): Promise<boolean> {
  if (!(await db().set(`survey:v:${s.visitId}`, 1, { nx: true }))) return false;
  const row: Survey = { ...s, id: randomId().slice(0, 10), t: Date.now() };
  await db().set(`survey:${row.id}`, row);
  await db().sadd("survey:idx", row.id);
  return true;
}
export const surveyDone = async (visitId: string) => Boolean(await db().get(`survey:v:${visitId}`));
export async function listSurveys(): Promise<Survey[]> {
  return ((await Promise.all((await db().smembers("survey:idx")).map((id) => db().get<Survey>(`survey:${id}`)))).filter(Boolean) as Survey[]).sort((a, b) => b.t - a.t);
}

/* ---------- patient <-> clinic chat ---------- */
export type Msg = { id: string; from: "pasien" | "klinik"; by: string; byName: string; text: string; t: number };
const ck = (pid: string) => `chat:${pid}`;
export const textSchema = z.string().trim().min(1).max(500);
export async function sendChat(patientId: string, from: Msg["from"], by: { id: string; name: string }, text: string) {
  const m: Msg = { id: randomId().slice(0, 10), from, by: by.id, byName: by.name, text, t: Date.now() };
  await db().lpush(ck(patientId), m);
  await db().sadd("chat:threads", patientId);
  await db().set(`chat:last:${patientId}`, { t: m.t, from, text: text.slice(0, 80) });
  const p = await getPatient(patientId);
  if (from === "pasien") {
    await db().set(`chat:unread:${patientId}`, m.t);
    await notifyRole("staf", { title: `Pesan dari ${p?.name ?? "pasien"}`, body: text.slice(0, 120), url: "/dashboard/pesan", tag: `chat-${patientId}` });
  } else {
    await db().set(`chat:pread:${patientId}`, 0);
    const uid = p?.userId ?? p?.guardianUserId;
    if (uid) await notifyUser(uid, { title: "Balasan dari klinik", body: text.slice(0, 120), url: "/portal/pesan", tag: `chat-${patientId}` });
  }
  return m;
}
export const chatMessages = async (patientId: string) => (await db().lrange<Msg>(ck(patientId), 0, 99)).reverse();
export const markStaffRead = (patientId: string) => db().del(`chat:unread:${patientId}`);
export async function chatThreads() {
  const ids = await db().smembers("chat:threads");
  const rows = await Promise.all(ids.map(async (id) => {
    const p = await getPatient(id);
    const last = await db().get<{ t: number; from: string; text: string }>(`chat:last:${id}`);
    const unread = Boolean(await db().get(`chat:unread:${id}`));
    return { patientId: id, name: p?.name ?? "-", rmNo: p?.rmNo ?? null, last, unread };
  }));
  return rows.filter((r) => r.last).sort((a, b) => (b.last!.t - a.last!.t));
}
