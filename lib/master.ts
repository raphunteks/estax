import "server-only";
import { z } from "zod";
import { db, memoByRev } from "@/lib/db/store";

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

export const featuresSchema = z.object({
  checkinWindowMin: z.number().int().min(0).max(240),
  recallRemindDays: z.number().int().min(0).max(30),
  recall: z.array(z.object({ id: z.string().regex(/^[a-z0-9-]{2,30}$/), name: z.string().trim().min(2).max(60), days: z.number().int().min(1).max(730) })).max(20),
  surveyEnabled: z.boolean(),
});
export const consentSchema = z.array(z.object({ id: z.string().regex(/^[a-z0-9-]{2,30}$/), title: z.string().trim().min(3).max(80), body: z.string().trim().min(10).max(4000), active: z.boolean() })).max(30);
export const eduSchema = z.array(z.object({ id: z.string().regex(/^[a-z0-9-]{2,30}$/), title: z.string().trim().min(3).max(80), body: z.string().trim().min(10).max(3000), keywords: z.string().trim().max(200), active: z.boolean() })).max(60);

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
  features: {
    checkinWindowMin: 60, recallRemindDays: 7, surveyEnabled: true,
    recall: [{ id: "scaling", name: "Scaling rutin", days: 180 }, { id: "tambal", name: "Kontrol tambalan", days: 14 }, { id: "behel", name: "Kontrol behel", days: 30 }],
  } satisfies z.infer<typeof featuresSchema>,
  consent: [
    { id: "umum", title: "Persetujuan tindakan kedokteran gigi", active: true, body: "Saya telah dijelaskan oleh dokter mengenai diagnosis, rencana tindakan, tujuan, manfaat, risiko, alternatif, dan perkiraan biaya. Saya diberi kesempatan bertanya dan pertanyaan saya telah dijawab. Dengan ini saya menyatakan SETUJU untuk dilakukan tindakan yang dijelaskan. Saya memahami bahwa persetujuan ini dapat saya cabut sebelum tindakan dilakukan." },
    { id: "cabut", title: "Persetujuan pencabutan gigi", active: true, body: "Saya telah dijelaskan mengenai pencabutan gigi, termasuk risiko perdarahan, nyeri, bengkak, infeksi, dry socket, dan kemungkinan cedera jaringan sekitar. Saya telah menyampaikan riwayat penyakit, alergi, dan obat yang saya konsumsi dengan benar. Saya menyatakan SETUJU untuk dilakukan pencabutan gigi." },
  ] satisfies z.infer<typeof consentSchema>,
  edu: [
    { id: "pasca-cabut", title: "Perawatan setelah cabut gigi", keywords: "cabut,ekstraksi,odontektomi", active: true, body: "Gigit kasa 30-60 menit. Jangan berkumur kuat, meludah, atau menghisap area luka selama 24 jam. Makan makanan lunak dan dingin hari pertama. Hindari rokok dan minuman panas. Kompres dingin 10-15 menit bila bengkak. Minum obat sesuai resep. Hubungi klinik bila perdarahan tidak berhenti atau nyeri memberat setelah 3 hari." },
    { id: "pasca-tambal", title: "Perawatan setelah tambal gigi", keywords: "tambal,restorasi,komposit", active: true, body: "Tunggu efek bius hilang sebelum makan agar tidak menggigit pipi atau lidah. Rasa ngilu ringan beberapa hari masih wajar. Hindari makanan sangat keras atau lengket pada sisi tambalan selama 24 jam. Hubungi klinik bila gigitan terasa tinggi atau nyeri bertahan lebih dari 1 minggu." },
    { id: "pasca-scaling", title: "Perawatan setelah scaling", keywords: "scaling,karang gigi,pembersihan", active: true, body: "Gusi dapat sedikit berdarah dan gigi terasa ngilu 1-3 hari. Sikat gigi lembut dua kali sehari, gunakan benang gigi, dan berkumur air garam hangat bila perlu. Hindari makanan dan minuman terlalu panas atau dingin selama 24 jam. Lakukan scaling rutin sesuai anjuran dokter." },
  ] satisfies z.infer<typeof eduSchema>,
};

export const KINDS = { poliklinik: poliklinikSchema, paytypes: payTypesSchema, rules: rulesSchema, features: featuresSchema, consent: consentSchema, edu: eduSchema } as const;
export type Kind = keyof typeof KINDS;

export async function getMaster<K extends Kind>(k: K) {
  return memoByRev(`master:${k}`, async () => {
    const v = await db().get(`master:${k}`);
    const d = DEFAULTS[k];
    if (v == null) return d as (typeof DEFAULTS)[K];
    // object masters gain new fields over time: stored values win, missing fields fall back to defaults
    return (Array.isArray(d) ? v : { ...d, ...(v as object) }) as (typeof DEFAULTS)[K];
  });
}
export const setMaster = (k: Kind, v: unknown) => db().set(`master:${k}`, v);
export const getSchedule = (id: string) => memoByRev(`schedule:${id}`, () => db().get<Schedule>(`master:schedule:${id}`));
export const setSchedule = (id: string, v: Schedule) => db().set(`master:schedule:${id}`, v);
