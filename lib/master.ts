import "server-only";
import { z } from "zod";
import { db } from "@/lib/db/store";

/** Master data lives in Redis and is edited by the superadmin. Defaults apply until the first save. */
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const poliklinikSchema = z.array(z.object({ id: z.string().regex(/^[a-z0-9-]{2,30}$/), name: z.string().trim().min(2).max(60), active: z.boolean(), color: z.string().regex(/^#[0-9a-fA-F]{6}$/) })).max(30);
export const payTypesSchema = z.array(z.object({ id: z.string().regex(/^[a-z0-9-]{2,30}$/), name: z.string().trim().min(2).max(60), kind: z.enum(["umum", "asuransi", "bpjs"]), active: z.boolean(), needsNumber: z.boolean() })).max(60);
export const rulesSchema = z.object({ monthlyTarget: z.number().int().min(1).max(5000).default(200), cancelHoursBefore: z.number().int().min(0).max(72), maxActiveBookings: z.number().int().min(1).max(10), slotGapMinutes: z.number().int().min(0).max(60), horizonDays: z.number().int().min(1).max(90) });
export const scheduleSchema = z.object({
  slotMinutes: z.number().int().refine((n) => [15, 20, 30, 45, 60, 90].includes(n)),
  poliklinikId: z.string().max(30).optional(),
  leave: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(120).optional(),
  days: z.partialRecord(z.enum(["0", "1", "2", "3", "4", "5", "6"]), z.array(z.object({ start: hhmm, end: hhmm })).max(4)),
}).superRefine((v, ctx) => {
  for (const [d, list] of Object.entries(v.days)) {
    const s = [...list].sort((a, b) => a.start.localeCompare(b.start));
    s.forEach((x, i) => {
      if (x.start >= x.end) ctx.addIssue({ code: "custom", message: `Hari ${d}: jam mulai harus sebelum selesai` });
      if (i > 0 && s[i - 1].end > x.start) ctx.addIssue({ code: "custom", message: `Hari ${d}: sesi tumpang tindih` });
    });
  }
});

export type Poliklinik = z.infer<typeof poliklinikSchema>[number];
export type PayType = z.infer<typeof payTypesSchema>[number];
export type Rules = z.infer<typeof rulesSchema>;
export type Schedule = z.infer<typeof scheduleSchema>;

export const DEFAULTS = {
  poliklinik: [
    { id: "umum", name: "Dokter Gigi Umum", active: true, color: "#46d9c6" },
    { id: "konservasi", name: "Spesialis Konservasi", active: true, color: "#8aa4ff" },
  ] satisfies Poliklinik[],
  paytypes: [
    { id: "umum", name: "Umum / Mandiri", kind: "umum", active: true, needsNumber: false },
    { id: "asuransi", name: "Asuransi swasta", kind: "asuransi", active: false, needsNumber: true },
    { id: "bpjs", name: "BPJS Kesehatan", kind: "bpjs", active: false, needsNumber: true },
  ] satisfies PayType[],
  rules: { monthlyTarget: 200, cancelHoursBefore: 1, maxActiveBookings: 2, slotGapMinutes: 0, horizonDays: 60 } satisfies Rules,
};

export const KINDS = { poliklinik: poliklinikSchema, paytypes: payTypesSchema, rules: rulesSchema } as const;
export type Kind = keyof typeof KINDS;

export async function getMaster<K extends Kind>(k: K) {
  return ((await db().get(`master:${k}`)) ?? DEFAULTS[k]) as (typeof DEFAULTS)[K];
}
export const setMaster = (k: Kind, v: unknown) => db().set(`master:${k}`, v);
export const getSchedule = (id: string) => db().get<Schedule>(`master:schedule:${id}`);
export const setSchedule = (id: string, v: Schedule) => db().set(`master:schedule:${id}`, v);
