import "server-only";
import { randomId } from "@/lib/auth/crypto";
import { getUser, listUsers } from "@/lib/auth/users";
import { db } from "@/lib/db/store";
import { getMaster, getSchedule } from "@/lib/master";
import { sendMail } from "@/lib/mail";
import { notifyRole, notifyUser } from "@/lib/push";
import { getPatient } from "./patients";
import { addDays, epoch, hhmm, mins, todayWita, weekday } from "./time";

export type Status = "menunggu" | "dikonfirmasi" | "checkin" | "dipanggil" | "dikursi" | "selesai" | "batal_pasien" | "batal_klinik" | "tidak_hadir";
export type Appt = {
  id: string; patientId: string; doctorId: string; poliklinikId?: string; date: string; time: string; endTime: string;
  payTypeId: string; payNumber?: string; complaint?: string; status: Status; source: "portal" | "staf" | "web";
  queueNo?: number; createdAt: number; createdBy: string; checkInAt?: number; calledAt?: number; recallAt?: number; seatedAt?: number; doneAt?: number;
  log: { t: number; by: string; action: string; note?: string }[];
};
export const ACTIVE: Status[] = ["menunggu", "dikonfirmasi", "checkin", "dipanggil", "dikursi"];
const HOLD_TTL = 300;
export const slotKey = (d: string, date: string, t: string) => `slot:${d}:${date}:${t}`;
const holdKey = (d: string, date: string, t: string) => `hold:${d}:${date}:${t}`;
export const getAppt = (id: string) => db().get<Appt>(`appt:${id}`);
const save = (a: Appt) => db().set(`appt:${a.id}`, a);

export type Slot = { start: string; end: string; state: "free" | "booked" | "held" | "past"; apptId?: string };

/** Slots of one doctor on one date: schedule sessions cut into slots, minus leave, past times, booked and held slots. */
export async function slotsFor(doctorId: string, date: string, viewer?: string): Promise<Slot[]> {
  const sch = await getSchedule(doctorId);
  if (!sch || sch.leave?.includes(date)) return [];
  const { slotGapMinutes } = await getMaster("rules");
  const out: Slot[] = [];
  for (const s of sch.days[String(weekday(date)) as "0"] ?? []) {
    for (let t = mins(s.start); t + sch.slotMinutes <= mins(s.end); t += sch.slotMinutes + slotGapMinutes) {
      const start = hhmm(t);
      const taken = await db().get<string>(slotKey(doctorId, date, start));
      const hold = taken ? null : await db().get<string>(holdKey(doctorId, date, start));
      const state: Slot["state"] = taken ? "booked" : epoch(date, start) <= Date.now() ? "past" : hold && hold !== viewer ? "held" : "free";
      out.push({ start, end: hhmm(t + sch.slotMinutes), state, apptId: taken ?? undefined });
    }
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}

export async function holdSlot(doctorId: string, date: string, time: string, holder: string) {
  const k = holdKey(doctorId, date, time);
  if (await db().set(k, holder, { nx: true, ex: HOLD_TTL })) return true;
  if ((await db().get<string>(k)) === holder) return (await db().set(k, holder, { ex: HOLD_TTL })), true;
  return false;
}

export async function notify(patientId: string, subject: string, text: string) {
  const p = await getPatient(patientId);
  const to = p?.email ?? (p?.userId ? (await getUser(p.userId))?.email : undefined);
  if (to) await sendMail(to, subject, `<p>${text.replace(/\n/g, "<br>")}</p>`, text).catch(() => null);
  if (p?.userId) await notifyUser(p.userId, { title: subject, body: text, url: "/portal/janji" });
}
/** Push + inbox only (no email) for the patient's portal account. */
export async function pushPatient(patientId: string, title: string, body: string, url = "/portal/janji") {
  const p = await getPatient(patientId);
  if (p?.userId) await notifyUser(p.userId, { title, body, url });
}
const when = (a: Pick<Appt, "date" | "time">) => `${a.date} pukul ${a.time} WITA`;

export type CreateInput = { patientId: string; doctorId: string; date: string; time: string; payTypeId: string; payNumber?: string; complaint?: string };
export type Err = { error: string; message: string; status: number };
const err = (error: string, message: string, status = 400): Err => ({ error, message, status });

export async function validateSlot(doctorId: string, date: string, time: string, viewer: string, ignoreApptId?: string): Promise<Err | null> {
  const doc = await getUser(doctorId);
  if (!doc || doc.role !== "dokter" || !doc.active) return err("doctor", "Dokter tidak ditemukan.", 404);
  const rules = await getMaster("rules");
  const today = todayWita();
  if (date < today || date > addDays(today, rules.horizonDays)) return err("horizon", `Tanggal di luar rentang ${rules.horizonDays} hari ke depan.`);
  const slot = (await slotsFor(doctorId, date, viewer)).find((s) => s.start === time);
  if (!slot) return err("no_slot", "Jam tidak tersedia di jadwal dokter.");
  if (slot.state === "past") return err("past", "Jam sudah lewat.");
  if (slot.state === "held") return err("slot_held", "Slot sedang dipilih pasien lain. Coba beberapa menit lagi.", 409);
  if (slot.state === "booked" && slot.apptId !== ignoreApptId) return err("slot_taken", "Slot sudah terisi.", 409);
  return null;
}

export async function createAppt(i: CreateInput, by: { id: string; role: string }): Promise<Appt | Err> {
  const pay = (await getMaster("paytypes")).find((x) => x.id === i.payTypeId && x.active);
  if (!pay) return err("paytype", "Jenis bayar tidak tersedia.");
  if (pay.needsNumber && !i.payNumber?.trim()) return err("paynumber", "Isi nomor kepesertaan.");
  const bad = await validateSlot(i.doctorId, i.date, i.time, by.id);
  if (bad) return bad;
  const rules = await getMaster("rules");
  const mine = await listAppts({ patientId: i.patientId });
  if ((by.role === "pasien" || by.role === "publik") && mine.filter((a) => ACTIVE.includes(a.status) && a.date >= todayWita()).length >= rules.maxActiveBookings) return err("limit", `Maksimal ${rules.maxActiveBookings} janji aktif.`, 409);
  const sch = (await getSchedule(i.doctorId))!;
  const id = randomId();
  if (!(await db().set(slotKey(i.doctorId, i.date, i.time), id, { nx: true }))) return err("slot_taken", "Slot sudah terisi.", 409); // atomic: two requests cannot both win
  await db().del(holdKey(i.doctorId, i.date, i.time));
  const a: Appt = { id, patientId: i.patientId, doctorId: i.doctorId, poliklinikId: sch.poliklinikId, date: i.date, time: i.time, endTime: hhmm(mins(i.time) + sch.slotMinutes), payTypeId: i.payTypeId, payNumber: i.payNumber?.trim(), complaint: i.complaint?.trim().slice(0, 300), status: by.role === "pasien" || by.role === "publik" ? "menunggu" : "dikonfirmasi", source: by.role === "publik" ? "web" : by.role === "pasien" ? "portal" : "staf", createdAt: Date.now(), createdBy: by.id, log: [{ t: Date.now(), by: by.id, action: "created" }] };
  await save(a);
  await indexAppt(a);
  if (a.status === "menunggu") await notifyRole("staf", { title: "Permintaan janji baru", body: `${a.date} pukul ${a.time} WITA`, url: "/dashboard/janji" });
  if (a.status === "dikonfirmasi") await notify(a.patientId, "Janji Estaka Dental Clinic dikonfirmasi", `Janji Anda pada ${when(a)} telah dikonfirmasi.`);
  return a;
}
const indexAppt = async (a: Appt) => {
  await db().sadd(`appts:date:${a.date}`, a.id);
  await db().sadd(`appts:patient:${a.patientId}`, a.id);
  await db().sadd("appts:all", a.id);
};

export async function listAppts(f: { date?: string; from?: string; to?: string; patientId?: string; doctorId?: string; status?: Status[] }): Promise<Appt[]> {
  let ids: string[];
  if (f.patientId) ids = await db().smembers(`appts:patient:${f.patientId}`);
  else if (f.date) ids = await db().smembers(`appts:date:${f.date}`);
  else if (f.from && f.to) {
    ids = [];
    for (let d = f.from; d <= f.to; d = addDays(d, 1)) ids.push(...(await db().smembers(`appts:date:${d}`)));
  } else ids = await db().smembers("appts:all");
  let rows = ((await Promise.all(ids.map(getAppt))).filter(Boolean) as Appt[]);
  if (f.doctorId) rows = rows.filter((a) => a.doctorId === f.doctorId);
  if (f.status) rows = rows.filter((a) => f.status!.includes(a.status));
  return rows.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}

const release = (a: Appt) => db().del(slotKey(a.doctorId, a.date, a.time));
const step = (a: Appt, by: string, action: string, note?: string) => a.log.push({ t: Date.now(), by, action, note });

export type Action = "confirm" | "reject" | "cancel" | "reschedule" | "checkin" | "call" | "recall" | "seat" | "done" | "noshow";
const FLOW: Record<string, { from: Status[]; to: Status }> = {
  confirm: { from: ["menunggu"], to: "dikonfirmasi" },
  checkin: { from: ["dikonfirmasi", "menunggu"], to: "checkin" },
  call: { from: ["checkin"], to: "dipanggil" },
  recall: { from: ["dipanggil"], to: "dipanggil" },
  seat: { from: ["dipanggil", "checkin"], to: "dikursi" },
  done: { from: ["dikursi"], to: "selesai" },
  noshow: { from: ["dikonfirmasi", "menunggu"], to: "tidak_hadir" },
};

export async function act(a: Appt, action: Action, by: { id: string; role: string }, p: { note?: string; date?: string; time?: string; doctorId?: string } = {}): Promise<Appt | Err> {
  const staff = by.role === "superadmin" || by.role === "staf";
  const rules = await getMaster("rules");
  if (by.role === "pasien") {
    if (action !== "cancel" && action !== "reschedule") return err("forbidden", "Tidak diizinkan.", 403);
    if (!ACTIVE.slice(0, 2).includes(a.status)) return err("state", "Janji tidak dapat diubah lagi.", 409);
    if (epoch(a.date, a.time) - Date.now() < rules.cancelHoursBefore * 3600e3) return err("too_late", `Perubahan hanya sampai ${rules.cancelHoursBefore} jam sebelum janji. Hubungi klinik via WhatsApp.`, 409);
  } else if (by.role === "dokter") {
    if (a.doctorId !== by.id || !["call", "recall", "seat", "done"].includes(action)) return err("forbidden", "Tidak diizinkan.", 403);
  } else if (!staff) return err("forbidden", "Tidak diizinkan.", 403);

  if (action === "cancel" || action === "reject") {
    if (!ACTIVE.slice(0, 2).includes(a.status) && !(staff && ACTIVE.includes(a.status))) return err("state", "Status tidak memungkinkan.", 409);
    a.status = by.role === "pasien" ? "batal_pasien" : "batal_klinik";
    await release(a);
    step(a, by.id, action, p.note);
    await save(a);
    await notify(a.patientId, "Janji dibatalkan", `Janji Anda pada ${when(a)} dibatalkan.${p.note ? `\nAlasan: ${p.note}` : ""}`);
    return a;
  }
  if (action === "reschedule") {
    if (!p.date || !p.time) return err("validation", "Pilih tanggal dan jam baru.");
    if (!ACTIVE.slice(0, 2).includes(a.status) && !(staff && ["checkin"].includes(a.status))) return err("state", "Status tidak memungkinkan.", 409);
    const doctorId = staff && p.doctorId ? p.doctorId : a.doctorId;
    const bad = await validateSlot(doctorId, p.date, p.time, by.id, a.id);
    if (bad) return bad;
    if (!(await db().set(slotKey(doctorId, p.date, p.time), a.id, { nx: true }))) return err("slot_taken", "Slot sudah terisi.", 409);
    await release(a); // old slot freed only after the new one is secured
    await db().srem(`appts:date:${a.date}`, a.id);
    const sch = (await getSchedule(doctorId))!;
    Object.assign(a, { doctorId, poliklinikId: sch.poliklinikId, date: p.date, time: p.time, endTime: hhmm(mins(p.time) + sch.slotMinutes) });
    if (by.role === "pasien") a.status = "menunggu";
    step(a, by.id, "reschedule", `${p.date} ${p.time}`);
    await save(a);
    await indexAppt(a);
    await notify(a.patientId, "Jadwal janji diubah", `Janji Anda kini pada ${when(a)}.`);
    return a;
  }
  const f = FLOW[action];
  if (!f || !f.from.includes(a.status)) return err("state", "Status tidak memungkinkan.", 409);
  if (action === "checkin" && a.date !== todayWita()) return err("date", "Check-in hanya pada hari janji.", 409);
  a.status = f.to;
  const now = Date.now();
  if (action === "checkin") {
    a.checkInAt = now;
    a.queueNo = await db().incr(`q:${a.date}:${a.doctorId}`);
  }
  if (action === "call" || action === "recall") await pushPatient(a.patientId, "Giliran Anda", `Nomor antrean ${a.queueNo ?? "-"}: silakan menuju ruang dokter.`);
  if (action === "call") a.calledAt = now;
  if (action === "recall") a.recallAt = now; // calledAt stays the first call so waiting-time stats are not skewed
  if (action === "seat") (a.seatedAt = now), (a.calledAt ??= now);
  if (action === "done") a.doneAt = now;
  if (action === "noshow") await release(a);
  step(a, by.id, action, p.note);
  await save(a);
  if (action === "confirm") await notify(a.patientId, "Janji dikonfirmasi", `Janji Anda pada ${when(a)} telah dikonfirmasi.`);
  return a;
}

export const isErr = (x: unknown): x is Err => typeof x === "object" && x !== null && "error" in x && "status" in x;

/** Calendar day for one doctor: every slot with its appointment (if any). */
export async function calendarDay(doctorId: string, date: string, viewer: string) {
  const slots = await slotsFor(doctorId, date, viewer);
  const appts = new Map((await listAppts({ date, doctorId })).filter((a) => ACTIVE.includes(a.status) || a.status === "selesai").map((a) => [a.id, a]));
  return slots.map((s) => ({ ...s, appt: s.apptId ? (appts.get(s.apptId) ?? null) : null }));
}
export const doctorsWithSchedule = async () => {
  const docs = (await listUsers()).filter((u) => u.role === "dokter" && u.active);
  return (await Promise.all(docs.map(async (d) => ({ id: d.id, name: d.name, schedule: await getSchedule(d.id) })))).filter((d) => d.schedule);
};
