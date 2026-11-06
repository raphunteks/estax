import "server-only";
import { getUser } from "@/lib/auth/users";
import type { Role } from "@/lib/auth/rbac";
import { listAppts, type Appt } from "./appointments";
import { listInvoices, type Invoice } from "./billing";
import { listItems, listRx, moves, stock, usable } from "./pharmacy";
import { getVisit, visitOfAppt, visitsOfPatient, type Visit } from "./visits";
import { addDays, todayWita } from "./time";

export const WAIT_TARGET_MIN = 20;
const ymd = (ms: number) => new Date(ms + 8 * 3600e3).toISOString().slice(0, 10);
const label = (d: string) => `${d.slice(8)}/${d.slice(5, 7)}`;
const min = (a?: number, b?: number) => (a && b && b >= a ? (b - a) / 60000 : null);
const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 10) / 10 : null);
const pct = (xs: number[], p: number) => (xs.length ? Math.round([...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * p))] * 10) / 10 : null);
const count = <T,>(xs: T[], key: (x: T) => string) => xs.reduce<Record<string, number>>((m, x) => ((m[key(x)] = (m[key(x)] ?? 0) + 1), m), {});
const top = (m: Record<string, number>, n: number) => Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, n).map(([name, value]) => ({ name, value }));

/** Sections each role may see. Revenue stays with superadmin and the doctor's own patients; staff get operations; pharmacists get pharmacy. */
export const sectionsFor = (role: Role) =>
  role === "superadmin" ? ["visits", "revenue", "procedures", "retention", "wait", "doctors", "funnel", "pharmacy"]
  : role === "dokter" ? ["visits", "revenue", "procedures", "retention", "wait", "funnel"]
  : role === "staf" ? ["visits", "procedures", "retention", "wait", "doctors", "funnel"]
  : role === "apoteker" ? ["pharmacy"] : [];

export async function analytics(user: { id: string; role: Role }, days: number) {
  const sections = sectionsFor(user.role);
  const to = todayWita(), from = addDays(to, -(days - 1));
  const doctorId = user.role === "dokter" ? user.id : undefined;
  const out: Record<string, unknown> = { from, to, days, sections, waitTarget: WAIT_TARGET_MIN };
  if (sections.includes("pharmacy")) out.pharmacy = await pharmacy();
  if (sections.length === 1 && sections[0] === "pharmacy") return out;

  const appts = await listAppts({ from, to, doctorId });
  const done = appts.filter((a) => a.status === "selesai");
  const visitIds = await Promise.all(done.map((a) => visitOfAppt(a.id)));
  const visits = ((await Promise.all(visitIds.map((id) => (id ? getVisit(id) : null)))).filter(Boolean) as Visit[]).filter((v) => v.status === "selesai");
  const dates = Array.from({ length: days }, (_, i) => addDays(from, i));

  // --- visits
  const live = appts.filter((a) => !["batal_pasien", "batal_klinik", "tidak_hadir"].includes(a.status));
  out.visits = {
    total: done.length,
    booked: live.length,
    perDay: dates.map((d) => ({ label: label(d), visits: done.filter((a) => a.date === d).length, booked: live.filter((a) => a.date === d).length })),
    byWeekday: ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"].map((n, i) => ({ name: n, value: done.filter((a) => new Date(`${a.date}T12:00:00+08:00`).getUTCDay() === i).length })),
    byHour: Array.from({ length: 12 }, (_, i) => i + 8).map((h) => ({ name: `${String(h).padStart(2, "0")}:00`, value: done.filter((a) => Number(a.time.slice(0, 2)) === h).length })),
  };

  // --- procedures
  if (sections.includes("procedures")) out.procedures = { total: visits.reduce((s, v) => s + v.procedures.length, 0), top: top(count(visits.flatMap((v) => v.procedures.map((p) => p.name.trim())), (x) => x), 10), perVisit: visits.length ? Math.round((visits.reduce((s, v) => s + v.procedures.length, 0) / visits.length) * 10) / 10 : 0 };

  // --- retention: new = first finished visit ever falls inside the range; returning = had one before
  if (sections.includes("retention")) {
    const pids = [...new Set(visits.map((v) => v.patientId))];
    const hist = await Promise.all(pids.map(async (p) => ({ p, v: (await visitsOfPatient(p)).filter((x) => x.status === "selesai").sort((a, b) => a.createdAt - b.createdAt) })));
    const first = new Map(hist.map((h) => [h.p, h.v[0]?.date ?? ""]));
    const newP = pids.filter((p) => (first.get(p) ?? "") >= from).length;
    const repeat = hist.filter((h) => h.v.length >= 2).length;
    const gaps = hist.flatMap((h) => h.v.slice(1).map((v, i) => (Date.parse(v.date) - Date.parse(h.v[i].date)) / 86400e3)).filter((g) => g > 0);
    out.retention = {
      patients: pids.length, newPatients: newP, returning: pids.length - newP,
      repeatRate: pids.length ? Math.round((repeat / pids.length) * 100) : null,
      avgGapDays: avg(gaps),
      cohort: [{ name: "Baru", value: newP }, { name: "Kembali", value: pids.length - newP }],
    };
  }

  // --- waiting time (check-in → called), chair time (seated → done)
  if (sections.includes("wait")) {
    const waits = appts.map((a) => min(a.checkInAt, a.calledAt)).filter((x): x is number => x !== null);
    const chair = appts.map((a) => min(a.seatedAt, a.doneAt)).filter((x): x is number => x !== null);
    const within = waits.filter((w) => w <= WAIT_TARGET_MIN).length;
    out.wait = {
      samples: waits.length, avg: avg(waits), median: pct(waits, 0.5), p90: pct(waits, 0.9), chairAvg: avg(chair),
      withinTarget: waits.length ? Math.round((within / waits.length) * 100) : null,
      buckets: [["< 10 mnt", (w: number) => w < 10], ["10–20", (w: number) => w >= 10 && w < 20], ["20–30", (w: number) => w >= 20 && w < 30], ["> 30", (w: number) => w >= 30]].map(([name, f]) => ({ name: name as string, value: waits.filter(f as (w: number) => boolean).length })),
    };
  }

  // --- booking funnel
  if (sections.includes("funnel")) {
    const confirmed = (a: Appt) => a.checkInAt || ["dikonfirmasi", "checkin", "dipanggil", "dikursi", "selesai", "tidak_hadir"].includes(a.status) || a.log.some((l) => l.action === "confirm");
    const stages = [
      { name: "Janji dibuat", value: appts.length },
      { name: "Dikonfirmasi", value: appts.filter(confirmed).length },
      { name: "Hadir (check-in)", value: appts.filter((a) => a.checkInAt || a.seatedAt || a.status === "selesai").length },
      { name: "Selesai", value: done.length },
    ];
    out.funnel = {
      stages,
      lost: { batal_pasien: appts.filter((a) => a.status === "batal_pasien").length, batal_klinik: appts.filter((a) => a.status === "batal_klinik").length, tidak_hadir: appts.filter((a) => a.status === "tidak_hadir").length },
      bySource: count(appts, (a) => a.source),
      completion: appts.length ? Math.round((done.length / appts.length) * 100) : null,
    };
  }

  // --- revenue (by invoice visit date; cash-in by payment date)
  if (sections.includes("revenue")) {
    const inv = (await listInvoices({ limit: 5000 })).filter((i) => i.status !== "batal" && (!doctorId || i.doctorId === doctorId));
    const inRange = (i: Invoice) => i.date >= from && i.date <= to;
    const pays = inv.flatMap((i) => i.payments.map((p) => ({ day: ymd(p.at), ...p })).filter((p) => p.day >= from && p.day <= to));
    const billed = inv.filter(inRange);
    const total = (i: Invoice) => Math.max(0, i.items.reduce((s, x) => s + x.qty * x.price, 0) - i.discount);
    const received = pays.reduce((s, p) => s + p.amount, 0);
    out.revenue = {
      received, billed: billed.reduce((s, i) => s + total(i), 0),
      outstanding: billed.reduce((s, i) => s + Math.max(0, total(i) - i.payments.reduce((a, p) => a + p.amount, 0)), 0),
      invoices: billed.length, avgInvoice: billed.length ? Math.round(billed.reduce((s, i) => s + total(i), 0) / billed.length) : 0,
      perDay: dates.map((d) => ({ label: label(d), value: pays.filter((p) => p.day === d).reduce((s, p) => s + p.amount, 0) })),
      byMethod: top(pays.reduce<Record<string, number>>((m, p) => ((m[p.method] = (m[p.method] ?? 0) + p.amount), m), {}), 6),
    };
  }

  // --- per doctor
  if (sections.includes("doctors")) {
    const ids = [...new Set(appts.map((a) => a.doctorId))];
    const inv = (await listInvoices({ limit: 5000 })).filter((i) => i.status !== "batal" && i.date >= from && i.date <= to);
    const rows = await Promise.all(ids.map(async (id) => {
      const mine = appts.filter((a) => a.doctorId === id), fin = mine.filter((a) => a.status === "selesai");
      const w = mine.map((a) => min(a.checkInAt, a.calledAt)).filter((x): x is number => x !== null), c = mine.map((a) => min(a.seatedAt, a.doneAt)).filter((x): x is number => x !== null);
      const decided = mine.filter((a) => ["selesai", "tidak_hadir"].includes(a.status)).length;
      return {
        id, name: (await getUser(id))?.name ?? "-", visits: fin.length, patients: new Set(fin.map((a) => a.patientId)).size,
        noShow: decided ? Math.round((mine.filter((a) => a.status === "tidak_hadir").length / decided) * 100) : null,
        avgWait: avg(w), avgChair: avg(c),
        revenue: user.role === "superadmin" ? inv.filter((i) => i.doctorId === id).reduce((s, i) => s + i.payments.reduce((a, p) => a + p.amount, 0), 0) : null,
      };
    }));
    out.doctors = rows.sort((a, b) => b.visits - a.visits);
  }
  return out;
}

async function pharmacy() {
  const [items, pending, log] = await Promise.all([listItems(), listRx("menunggu"), moves()]);
  const today = todayWita(), soon = addDays(today, 60);
  const active = items.filter((i) => i.active);
  const used: Record<string, number> = {};
  for (const m of log) if (m.type === "dispense") used[m.name] = (used[m.name] ?? 0) - m.qty;
  return {
    items: active.length,
    low: active.filter((i) => usable(i) < i.min).map((i) => ({ name: i.name, stock: usable(i), min: i.min, unit: i.unit })),
    expired: active.filter((i) => i.batches.some((b) => b.expiry && b.expiry < today && b.qty > 0)).map((i) => ({ name: i.name, qty: i.batches.filter((b) => b.expiry && b.expiry < today).reduce((s, b) => s + b.qty, 0), unit: i.unit })),
    expiring: active.filter((i) => i.batches.some((b) => b.expiry && b.expiry >= today && b.expiry <= soon && b.qty > 0)).map((i) => ({ name: i.name, unit: i.unit, qty: i.batches.filter((b) => b.expiry && b.expiry >= today && b.expiry <= soon).reduce((s, b) => s + b.qty, 0) })),
    stockValue: active.reduce((s, i) => s + (i.price ?? 0) * stock(i), 0),
    rxWaiting: pending.length,
    topDispensed: top(used, 8),
    basis: log.length >= 200 ? "200 mutasi terakhir" : `${log.length} mutasi tercatat`,
  };
}
