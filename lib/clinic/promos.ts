import "server-only";
import { z } from "zod";
import { randomId } from "@/lib/auth/crypto";
import { db } from "@/lib/db/store";
import { todayWita } from "./time";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const promoSchema = z.object({
  name: z.string().trim().min(3).max(80),
  desc: z.string().trim().max(400).default(""),
  kind: z.enum(["percent", "amount", "free"]),
  value: z.number().int().min(0).max(100_000_000),
  tariffIds: z.array(z.string().max(40)).max(30).default([]),
  poliklinikId: z.string().max(30).optional(),
  doctorId: z.string().max(40).optional(),
  start: date, end: date,
  quota: z.number().int().min(0).max(100000).default(0),
  perPatient: z.number().int().min(1).max(20).default(1),
  audience: z.enum(["all", "new", "returning"]).default("all"),
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{3,20}$/).optional().or(z.literal("").transform(() => undefined)),
  status: z.enum(["draf", "aktif", "jeda"]),
}).superRefine((v, c) => {
  if (v.end < v.start) c.addIssue({ code: "custom", message: "Tanggal selesai harus setelah mulai." });
  if (v.kind === "percent" && (v.value < 1 || v.value > 100)) c.addIssue({ code: "custom", message: "Persen harus 1 sampai 100." });
  if (v.kind === "amount" && v.value < 1000) c.addIssue({ code: "custom", message: "Nominal minimal Rp 1.000." });
  if (v.kind === "free" && !v.tariffIds.length) c.addIssue({ code: "custom", message: "Pilih tindakan yang digratiskan." });
});
export type PromoInput = z.infer<typeof promoSchema>;
export type Promo = PromoInput & { id: string; createdBy: string; createdAt: number; announcedAt?: number };

const pk = (id: string) => `promo:${id}`;
export const getPromo = (id: string) => db().get<Promo>(pk(id));
export async function listPromos(): Promise<Promo[]> {
  const all = (await Promise.all((await db().smembers("promo:idx")).map(getPromo))).filter(Boolean) as Promo[];
  return all.sort((a, b) => b.createdAt - a.createdAt);
}
export async function createPromo(d: PromoInput, by: string): Promise<Promo> {
  const p: Promo = { ...d, id: randomId().slice(0, 12), createdBy: by, createdAt: Date.now() };
  await db().set(pk(p.id), p); await db().sadd("promo:idx", p.id);
  return p;
}
export const savePromo = (p: Promo) => db().set(pk(p.id), p);
export async function deletePromo(id: string) { await db().del(pk(id)); await db().srem("promo:idx", id); }

export const claimsOf = async (id: string) => Number((await db().get<number>(`promo:n:${id}`)) ?? 0);
export const viewsOf = async (id: string) => (await db().smembers(`promo:vs:${id}`)).length;
export const markViewed = (id: string, patientId: string) => db().sadd(`promo:vs:${id}`, patientId);
export const isLive = (p: Promo, today = todayWita()) => p.status === "aktif" && p.start <= today && p.end >= today;

/** Why a patient cannot use a promo now, or null. `returning` = has at least one finished visit. */
export async function blocker(p: Promo, patientId: string, returning: boolean, doctorId?: string, poliklinikId?: string): Promise<string | null> {
  if (!isLive(p)) return "Promo tidak berlaku saat ini.";
  if (p.audience === "new" && returning) return "Promo khusus pasien baru.";
  if (p.audience === "returning" && !returning) return "Promo khusus pasien yang pernah berkunjung.";
  if (p.doctorId && doctorId && p.doctorId !== doctorId) return "Promo tidak berlaku untuk dokter ini.";
  if (p.poliklinikId && poliklinikId && p.poliklinikId !== poliklinikId) return "Promo tidak berlaku untuk poliklinik ini.";
  if (p.quota && (await claimsOf(p.id)) >= p.quota) return "Kuota promo sudah habis.";
  if (Number((await db().get<number>(`promo:pc:${p.id}:${patientId}`)) ?? 0) >= p.perPatient) return "Batas pemakaian promo untuk Anda sudah tercapai.";
  return null;
}
export async function claim(p: Promo, patientId: string) {
  await db().incr(`promo:n:${p.id}`);
  await db().incr(`promo:pc:${p.id}:${patientId}`);
}

/** Discount in rupiah for a list of priced items. `free` removes the price of the named tariffs (by tariff name). */
export function discountFor(p: Pick<Promo, "kind" | "value" | "tariffIds">, items: { name: string; qty: number; price: number }[], tariffNames: Map<string, string>): number {
  const scope = p.tariffIds.length ? items.filter((i) => p.tariffIds.some((t) => i.name.toLowerCase().startsWith((tariffNames.get(t) ?? "\u0000").toLowerCase()))) : items;
  const base = scope.reduce((s, i) => s + i.qty * i.price, 0);
  if (p.kind === "percent") return Math.floor((base * p.value) / 100);
  if (p.kind === "amount") return Math.min(p.value, base);
  return base;
}
