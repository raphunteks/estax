import { db } from "@/lib/db/store";
import { fillWa } from "@/lib/site-types";
import { waPhone } from "@/lib/wa";
import { getSite } from "@/lib/site";
import { clinic } from "@/lib/content";
import { hermesConfigured, sendWhatsApp } from "@/lib/notify/hermes";
import { sendMail, siteUrl } from "@/lib/mail";
import { getUser } from "@/lib/auth/users";
import { listAppts, type Appt } from "./appointments";
import { getPatient } from "./patients";
import { addDays, epoch, todayWita } from "./time";

const dayName = (d: string) => new Date(`${d}T12:00:00+08:00`).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const once = (k: string) => db().set(`rem:${k}`, 1, { nx: true, ex: 5 * 86400 });
const undo = (k: string) => db().del(`rem:${k}`);

async function ctx(a: Appt) {
  const [p, dr] = await Promise.all([getPatient(a.patientId), getUser(a.doctorId)]);
  const email = p?.email ?? (p?.userId ? (await getUser(p.userId))?.email : undefined);
  return { p, email, v: { nama: p?.name ?? "Pasien", tanggal: dayName(a.date), jam: a.time, dokter: dr?.name ?? "dokter", klinik: clinic.name } };
}

export async function sendWaFor(a: Appt, opts: { force?: boolean } = {}): Promise<{ ok: boolean; reason?: string }> {
  const s = await getSite();
  if (!hermesConfigured()) return { ok: false, reason: "not_configured" };
  const { p, v } = await ctx(a);
  const phone = waPhone(p?.phone);
  if (!phone) return { ok: false, reason: "no_phone" };
  const key = `${a.id}:wa`;
  if (!opts.force && !(await once(key))) return { ok: false, reason: "already_sent" };
  const r = await sendWhatsApp(phone, fillWa(s.wa.template, v), `rem-${a.id}-${opts.force ? Date.now() : "auto"}`);
  if (!r.ok && !opts.force) await undo(key);
  if (r.ok && opts.force) await db().set(`rem:${key}`, 1, { ex: 5 * 86400 });
  return r;
}

/** Email H-1 (24 h) and 2 h before; WhatsApp at the configured number of hours. Each is sent once per appointment. Run every 10–15 minutes. */
export async function runReminders(now = Date.now()) {
  const s = await getSite();
  const t = todayWita();
  const rows = (await listAppts({ from: t, to: addDays(t, 4), status: ["dikonfirmasi"] })).filter((a) => epoch(a.date, a.time) > now);
  const res = { checked: rows.length, email: 0, wa: 0, failed: 0 };
  for (const a of rows) {
    const h = (epoch(a.date, a.time) - now) / 3600e3;
    if (s.wa.email !== false) {
      const kind = h <= 2 ? "e2" : h <= 24 ? "e24" : null;
      if (kind) {
        if (kind === "e2") await once(`${a.id}:e24`); // never send the day-before mail after the 2-hour one
        if (await once(`${a.id}:${kind}`)) {
          const { email, v } = await ctx(a);
          if (email) {
            const text = `Halo ${v.nama}, pengingat janji Anda di ${v.klinik}:\n${v.tanggal}, pukul ${v.jam} WITA dengan ${v.dokter}.\n\nUbah atau batalkan lewat portal pasien: ${siteUrl()}/portal/janji`;
            try { await sendMail(email, `Pengingat janji ${v.tanggal} pukul ${v.jam}`, `<p>${text.replace(/\n/g, "<br>")}</p>`, text); res.email++; } catch { await undo(`${a.id}:${kind}`); res.failed++; }
          }
        }
      }
    }
    if (s.wa.enabled && h <= s.wa.hoursBefore && hermesConfigured()) {
      const r = await sendWaFor(a);
      if (r.ok) res.wa++; else if (r.reason !== "already_sent" && r.reason !== "no_phone") res.failed++;
    }
  }
  return res;
}
