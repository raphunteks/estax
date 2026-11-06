import { z } from "zod";
import { db } from "@/lib/db/store";
import { randomId } from "@/lib/auth/crypto";
import { notifyRole } from "@/lib/push";
import { pushPatient } from "./appointments";
import { getVisit } from "./visits";
import { todayWita } from "./time";
import { withLock, isBusy } from "./lock";

export const KIND = ["obat", "bahan", "alat"] as const;
export const itemSchema = z.object({ name: z.string().trim().min(2).max(120), kind: z.enum(KIND), unit: z.string().trim().min(1).max(20), min: z.number().int().min(0).max(100000), price: z.number().int().min(0).max(1_000_000_000).optional(), active: z.boolean().default(true) });
export const patchSchema = z.object({
  name: itemSchema.shape.name.optional(), unit: itemSchema.shape.unit.optional(), min: itemSchema.shape.min.optional(), price: itemSchema.shape.price, active: z.boolean().optional(),
  restock: z.object({ qty: z.number().int().min(1).max(100000), expiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), lot: z.string().trim().max(40).optional(), note: z.string().trim().max(120).optional() }).optional(),
  count: z.object({ qty: z.number().int().min(0).max(1000000), note: z.string().trim().max(120).optional() }).optional(),
});
export type Batch = { id: string; qty: number; expiry?: string; lot?: string };
export type Item = z.infer<typeof itemSchema> & { id: string; batches: Batch[]; createdAt: number; calledAt?: number; recallAt?: number };
export const stock = (i: Pick<Item, "batches">) => i.batches.reduce((s, b) => s + b.qty, 0);
export const usable = (i: Pick<Item, "batches">, today = todayWita()) => i.batches.filter((b) => !b.expiry || b.expiry >= today).reduce((s, b) => s + b.qty, 0);

const ik = (id: string) => `ph:item:${id}`;
export const getItem = async (id: string) => { const v = await db().get<Item>(ik(id)); return v ? structuredClone(v) : null; };
export async function listItems() {
  const ids = await db().smembers("ph:items");
  return ((await Promise.all(ids.map(getItem))).filter(Boolean) as Item[]).sort((a, b) => a.name.localeCompare(b.name));
}
export type Move = { t: number; by: string; itemId: string; name: string; type: "restock" | "dispense" | "count" | "create"; qty: number; note?: string };
const log = (m: Omit<Move, "t">) => db().lpush("ph:log", { ...m, t: Date.now() });
export const moves = () => db().lrange<Move>("ph:log", 0, 199);

export async function createItem(d: z.infer<typeof itemSchema>, by: string) {
  const it: Item = { ...d, id: randomId().slice(0, 12), batches: [], createdAt: Date.now() };
  await db().set(ik(it.id), it); await db().sadd("ph:items", it.id); await log({ by, itemId: it.id, name: it.name, type: "create", qty: 0 });
  return it;
}

/** First-expired-first-out. Expired batches are never dispensed. */
function take(it: Item, qty: number): boolean {
  const today = todayWita();
  const bs = it.batches.filter((b) => !b.expiry || b.expiry >= today).sort((a, b) => (a.expiry ?? "9999").localeCompare(b.expiry ?? "9999"));
  if (bs.reduce((s, b) => s + b.qty, 0) < qty) return false;
  let left = qty;
  for (const b of bs) { const n = Math.min(b.qty, left); b.qty -= n; left -= n; if (!left) break; }
  it.batches = it.batches.filter((b) => b.qty > 0);
  return true;
}

/** Stock-count correction: removes from the oldest batches first, expired included. */
function drain(it: Item, qty: number) {
  let left = qty;
  for (const b of it.batches.sort((a, c) => (a.expiry ?? "9999").localeCompare(c.expiry ?? "9999"))) { const n = Math.min(b.qty, left); b.qty -= n; left -= n; if (!left) break; }
  it.batches = it.batches.filter((b) => b.qty > 0);
}

type R = { ok: true; item: Item } | { ok: false; code: string; message: string; status: number };
export async function patchItem(id: string, d: z.infer<typeof patchSchema>, by: string): Promise<R> {
  const r = await withLock(`ph:${id}`, async (): Promise<R> => {
    const it = await getItem(id);
    if (!it) return { ok: false, code: "not_found", message: "Item tidak ditemukan.", status: 404 };
    if (d.name !== undefined) it.name = d.name; if (d.unit !== undefined) it.unit = d.unit; if (d.min !== undefined) it.min = d.min;
    if ("price" in d && d.price !== undefined) it.price = d.price; if (d.active !== undefined) it.active = d.active;
    if (d.restock) {
      it.batches.push({ id: randomId().slice(0, 8), qty: d.restock.qty, expiry: d.restock.expiry, lot: d.restock.lot });
      await log({ by, itemId: id, name: it.name, type: "restock", qty: d.restock.qty, note: d.restock.note });
    }
    if (d.count) {
      const diff = d.count.qty - stock(it);
      if (diff > 0) it.batches.push({ id: randomId().slice(0, 8), qty: diff, lot: "opname" });
      else if (diff < 0) drain(it, -diff);
      await log({ by, itemId: id, name: it.name, type: "count", qty: diff, note: d.count.note });
    }
    await db().set(ik(id), it);
    return { ok: true, item: it };
  });
  return isBusy(r) ? { ok: false, code: "busy", message: "Sedang diproses, coba lagi.", status: 423 } : r;
}

// ---- prescriptions ----
export type RxLine = { id: string; drug: string; dose: string; freq: string; days: string; note?: string };
export type Rx = { visitId: string; patientId: string; doctorId: string; date: string; lines: RxLine[]; allergies: string; status: "menunggu" | "selesai"; done?: { by: string; at: number; items: { lineId: string; itemId: string | null; qty: number }[] }; createdAt: number; calledAt?: number; recallAt?: number };
const rk = (v: string) => `rx:${v}`;
export const getRx = async (visitId: string) => { const v = await db().get<Rx>(rk(visitId)); return v ? structuredClone(v) : null; };

/** Called when a visit is finished and has a prescription. Idempotent. */
export async function queueRx(visitId: string) {
  const v = await getVisit(visitId);
  if (!v || !v.rx.length) return;
  const rx: Rx = { visitId, patientId: v.patientId, doctorId: v.doctorId, date: v.date, lines: v.rx.map((l) => ({ id: l.id, drug: l.drug, dose: l.dose, freq: l.freq, days: l.days, note: l.note })), allergies: v.anamnesis.allergies ?? "", status: "menunggu", createdAt: Date.now() };
  if (await db().set(`rx:q:${visitId}`, 1, { nx: true })) { await db().set(rk(visitId), rx); await db().sadd("rx:idx", visitId); await notifyRole("apoteker", { title: "Resep baru", body: `${rx.lines.length} obat menunggu diproses.`, url: "/dashboard/farmasi" }); }
}
/** Marks a prescription as called to the counter (first call or repeat). Returns null when it is not waiting. */
export async function callRx(visitId: string): Promise<Rx | null> {
  const rx = await getRx(visitId);
  if (!rx || rx.status !== "menunggu") return null;
  const now = Date.now();
  if (rx.calledAt) rx.recallAt = now; else rx.calledAt = now;
  await db().set(rk(visitId), rx);
  await pushPatient(rx.patientId, "Obat Anda siap", "Silakan menuju loket farmasi.", "/portal");
  return rx;
}
export async function listRx(status?: Rx["status"]) {
  const ids = await db().smembers("rx:idx");
  return ((await Promise.all(ids.map(getRx))).filter(Boolean) as Rx[]).filter((r) => !status || r.status === status).sort((a, b) => b.createdAt - a.createdAt).slice(0, 200);
}
/** Heuristic only: a word (4+ letters) from the allergy note appearing in a drug or item name. */
export function allergyHits(allergies: string, names: string[]) {
  const words = allergies.toLowerCase().split(/[^a-z]+/).filter((w) => w.length >= 4 && !["alergi", "tidak", "obat", "makanan", "debu", "riwayat"].includes(w));
  return names.filter((n) => words.some((w) => n.toLowerCase().includes(w)));
}
export const dispenseSchema = z.object({ items: z.array(z.object({ lineId: z.string().max(40), itemId: z.string().max(20).nullable(), qty: z.number().int().min(0).max(10000) })).max(30), ack: z.boolean().optional() });
export async function dispense(visitId: string, d: z.infer<typeof dispenseSchema>, by: string): Promise<{ ok: true } | { ok: false; code: string; message: string; status: number; warnings?: string[] }> {
  const r = await withLock(`rx:${visitId}`, async () => {
    const rx = await getRx(visitId);
    if (!rx) return { ok: false as const, code: "not_found", message: "Resep tidak ditemukan.", status: 404 };
    if (rx.status !== "menunggu") return { ok: false as const, code: "done", message: "Resep sudah diserahkan.", status: 409 };
    const lines = new Set(rx.lines.map((l) => l.id));
    if (d.items.length !== rx.lines.length || d.items.some((x) => !lines.has(x.lineId))) return { ok: false as const, code: "validation", message: "Semua baris resep harus diisi (atau dikosongkan).", status: 400 };
    const picked = await Promise.all(d.items.map(async (x) => ({ x, it: x.itemId && x.qty > 0 ? await getItem(x.itemId) : null })));
    if (picked.some((p) => p.x.itemId && p.x.qty > 0 && (!p.it || p.it.kind !== "obat"))) return { ok: false as const, code: "validation", message: "Pilih item obat yang valid.", status: 400 };
    const warnings = allergyHits(rx.allergies, [...rx.lines.map((l) => l.drug), ...picked.map((p) => p.it?.name ?? "")].filter(Boolean));
    if (warnings.length && !d.ack) return { ok: false as const, code: "allergy", message: "Kemungkinan terkait alergi pasien. Periksa lalu konfirmasi.", status: 409, warnings };
    const done: NonNullable<Rx["done"]>["items"] = [];
    const cache = new Map<string, Item>();
    for (const { x, it } of picked) {
      if (!it) { done.push({ lineId: x.lineId, itemId: null, qty: 0 }); continue; }
      const cur = cache.get(it.id) ?? (await getItem(it.id))!;
      if (!take(cur, x.qty)) return { ok: false as const, code: "stock", message: `Stok ${it.name} tidak cukup (tidak termasuk yang kedaluwarsa).`, status: 409 };
      cache.set(it.id, cur); done.push({ lineId: x.lineId, itemId: it.id, qty: x.qty });
    }
    for (const it of cache.values()) await db().set(ik(it.id), it);
    for (const m of done) if (m.itemId) await log({ by, itemId: m.itemId, name: cache.get(m.itemId)!.name, type: "dispense", qty: -m.qty, note: `resep ${visitId.slice(0, 6)}` });
    rx.status = "selesai"; rx.done = { by, at: Date.now(), items: done };
    await pushPatient(rx.patientId, "Obat telah diserahkan", "Terima kasih. Semoga lekas pulih.", "/portal/riwayat");
    await db().set(rk(visitId), rx);
    return { ok: true as const };
  });
  return isBusy(r) ? { ok: false as const, code: "busy", message: "Sedang diproses, coba lagi.", status: 423 } : r;
}
