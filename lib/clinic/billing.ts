import { z } from "zod";
import { db, memoByRev } from "@/lib/db/store";
import { randomId } from "@/lib/auth/crypto";
import { getAppt } from "./appointments";
import { discountFor, getPromo } from "./promos";
import { getVisit } from "./visits";
import { withLock, isBusy } from "./lock";

const money = z.number().int().min(0).max(1_000_000_000);
export const tariffsSchema = z.array(z.object({ id: z.string().regex(/^[a-z0-9-]{2,40}$/), code: z.string().trim().max(20), name: z.string().trim().min(2).max(120), price: money, poliklinikId: z.string().max(30).optional(), active: z.boolean() })).max(300);
export type Tariff = z.infer<typeof tariffsSchema>[number];
export const getTariffs = async () => memoByRev("master:tariffs", async () => ((await db().get<Tariff[]>("master:tariffs")) ?? []) as Tariff[]);
export const setTariffs = (v: Tariff[]) => db().set("master:tariffs", v);

export const METHODS = ["tunai", "transfer", "qris", "debit", "asuransi", "bpjs"] as const;
export const itemsSchema = z.array(z.object({ id: z.string().max(40), name: z.string().trim().min(1).max(160), qty: z.number().int().min(1).max(999), price: money })).max(60);
export const patchSchema = z.object({
  items: itemsSchema.optional(),
  discount: money.optional(),
  pay: z.object({ amount: z.number().int().min(1).max(1_000_000_000), method: z.enum(METHODS), note: z.string().trim().max(120).optional() }).optional(),
  voidRequest: z.object({ reason: z.string().trim().min(3).max(200) }).optional(),
  voidDecide: z.enum(["approve", "reject"]).optional(),
  voidNow: z.object({ reason: z.string().trim().min(3).max(200) }).optional(),
});

export type Payment = { id: string; amount: number; method: (typeof METHODS)[number]; at: number; by: string; note?: string };
export type Invoice = {
  id: string; no: string; visitId: string; patientId: string; doctorId: string; date: string;
  items: z.infer<typeof itemsSchema>; discount: number; promoId?: string; promoName?: string; payments: Payment[];
  status: "belum" | "sebagian" | "lunas" | "batal";
  voidReq?: { by: string; reason: string; at: number }; voidInfo?: { by: string; reason: string; at: number };
  createdAt: number; updatedAt: number;
};

export const total = (i: Pick<Invoice, "items" | "discount">) => Math.max(0, i.items.reduce((s, x) => s + x.qty * x.price, 0) - i.discount);
export const paid = (i: Pick<Invoice, "payments">) => i.payments.reduce((s, p) => s + p.amount, 0);
export const due = (i: Invoice) => Math.max(0, total(i) - paid(i));
const statusOf = (i: Invoice): Invoice["status"] => (i.status === "batal" ? "batal" : paid(i) <= 0 ? "belum" : paid(i) >= total(i) ? "lunas" : "sebagian");

const key = (id: string) => `inv:${id}`;
/** Always a copy, so a rejected edit can never leak into the stored object (matters for the in-memory dev store). */
export const getInvoice = async (id: string) => { const v = await db().get<Invoice>(key(id)); return v ? structuredClone(v) : null; };
const save = async (i: Invoice) => (i.updatedAt = Date.now(), i.status = statusOf(i), db().set(key(i.id), i));

/** One invoice per finished visit (NX index). Procedures are priced from the tariff list by name or code; unknown ones stay at 0 for the cashier to fill. */
export async function invoiceFromVisit(visitId: string): Promise<Invoice | null> {
  const v = await getVisit(visitId);
  if (!v || v.status !== "selesai") return null;
  const id = randomId();
  if (!(await db().set(`inv:visit:${visitId}`, id, { nx: true }))) {
    const ex = await db().get<string>(`inv:visit:${visitId}`);
    return ex ? getInvoice(ex) : null;
  }
  const tariffs = (await getTariffs()).filter((t) => t.active);
  const items = v.procedures.map((p) => {
    const n = p.name.trim().toLowerCase();
    const t = tariffs.find((x) => x.name.toLowerCase() === n || (x.code && x.code.toLowerCase() === n));
    return { id: randomId().slice(0, 10), name: p.tooth ? `${p.name} (gigi ${p.tooth})` : p.name, qty: 1, price: t?.price ?? 0 };
  });
  let discount = 0, promoId: string | undefined, promoName: string | undefined;
  const ap = await getAppt(v.apptId);
  const pr = ap?.promoId ? await getPromo(ap.promoId) : null;
  if (pr) {
    discount = Math.min(discountFor(pr, items, new Map(tariffs.map((t) => [t.id, t.name]))), items.reduce((s, i) => s + i.qty * i.price, 0));
    promoId = pr.id; promoName = pr.name;
  }
  const seq = await db().incr(`inv:seq:${v.date.slice(2, 4)}${v.date.slice(5, 7)}`);
  const inv: Invoice = { id, no: `INV-${v.date.slice(2, 4)}${v.date.slice(5, 7)}-${String(seq).padStart(4, "0")}`, visitId, patientId: v.patientId, doctorId: v.doctorId, date: v.date, items, discount, promoId, promoName, payments: [], status: "belum", createdAt: Date.now(), updatedAt: Date.now() };
  await save(inv);
  await db().sadd("inv:idx", id);
  await db().sadd(`inv:p:${v.patientId}`, id);
  return inv;
}

export async function listInvoices(f: { patientId?: string; status?: string; limit?: number } = {}) {
  const ids = f.patientId ? await db().smembers(`inv:p:${f.patientId}`) : await db().smembers("inv:idx");
  if (!ids.length) return [];
  const all = ((await db().mget<Invoice>(...ids.map(key))).filter(Boolean) as Invoice[]).map((i) => structuredClone(i));
  return all.filter((i) => !f.status || f.status.split(",").includes(i.status)).sort((a, b) => b.createdAt - a.createdAt).slice(0, f.limit ?? 200);
}

type R = { ok: true; inv: Invoice } | { ok: false; code: string; message: string; status: number };
const bad = (code: string, message: string, status = 409): R => ({ ok: false, code, message, status });

export async function mutate(id: string, d: z.infer<typeof patchSchema>, by: { id: string; role: string }): Promise<R> {
  const r = await withLock(`inv:${id}`, async (): Promise<R> => {
    const inv = await getInvoice(id);
    if (!inv) return bad("not_found", "Invoice tidak ditemukan.", 404);
    if (inv.status === "batal") return bad("void", "Invoice sudah dibatalkan.");
    const isSuper = by.role === "superadmin";
    if (d.items || d.discount !== undefined) {
      if (inv.payments.length) return bad("locked", "Invoice sudah ada pembayaran; item tidak dapat diubah.");
      if (d.items) inv.items = d.items;
      if (d.discount !== undefined) inv.discount = d.discount;
      if (inv.discount > inv.items.reduce((s, x) => s + x.qty * x.price, 0)) return bad("validation", "Diskon melebihi subtotal.", 400);
    }
    if (d.pay) {
      if (total(inv) <= 0) return bad("validation", "Total invoice masih Rp0; isi harga dulu.", 400);
      if (d.pay.amount > due(inv)) return bad("validation", "Nominal melebihi sisa tagihan.", 400);
      inv.payments.push({ id: randomId().slice(0, 10), amount: d.pay.amount, method: d.pay.method, at: Date.now(), by: by.id, note: d.pay.note });
    }
    if (d.voidRequest) {
      if (inv.payments.length) return bad("locked", "Sudah ada pembayaran; invoice tidak dapat dibatalkan.");
      inv.voidReq = { by: by.id, reason: d.voidRequest.reason, at: Date.now() };
    }
    if (d.voidDecide || d.voidNow) {
      if (!isSuper) return bad("forbidden", "Hanya superadmin.", 403);
      if (inv.payments.length) return bad("locked", "Sudah ada pembayaran; invoice tidak dapat dibatalkan.");
      if (d.voidDecide === "reject") delete inv.voidReq;
      else if (d.voidDecide === "approve" && inv.voidReq) (inv.voidInfo = { ...inv.voidReq, by: by.id }, inv.status = "batal", delete inv.voidReq);
      else if (d.voidNow) (inv.voidInfo = { by: by.id, reason: d.voidNow.reason, at: Date.now() }, inv.status = "batal");
      else return bad("validation", "Tidak ada permintaan pembatalan.", 400);
    }
    await save(inv);
    return { ok: true, inv };
  });
  return isBusy(r) ? bad("busy", "Sedang diproses, coba lagi.", 423) : r;
}

/** Cash-in per day and method, by payment date (WITA). */
export async function report(from: string, to: string) {
  const inv = await listInvoices({ limit: 5000 });
  const byMethod: Record<string, number> = {}, byDay: Record<string, number> = {};
  let received = 0, outstanding = 0, count = 0;
  for (const i of inv) {
    if (i.status === "batal") continue;
    if (i.date >= from && i.date <= to) (count++, (outstanding += due(i)));
    for (const p of i.payments) {
      const day = new Date(p.at + 8 * 3600e3).toISOString().slice(0, 10);
      if (day < from || day > to) continue;
      received += p.amount; byMethod[p.method] = (byMethod[p.method] ?? 0) + p.amount; byDay[day] = (byDay[day] ?? 0) + p.amount;
    }
  }
  return { received, outstanding, invoices: count, byMethod, byDay };
}
