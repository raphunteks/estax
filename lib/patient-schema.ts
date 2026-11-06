import { z } from "zod";
import { normalizePhone, validNik, ageOf } from "./nik";

const text = (max: number) => z.string().trim().max(max);
const phone = z.string().transform((v, ctx) => normalizePhone(v) ?? (ctx.addIssue({ code: "custom", message: "Nomor HP tidak valid." }), z.NEVER));

export const step1 = z.object({
  idType: z.enum(["wni", "wna"]),
  idNumber: z.string().trim().min(5).max(20),
  name: z.string().trim().min(3, "Nama terlalu pendek.").max(80),
  email: z.string().trim().email("Email tidak valid.").max(120),
  gender: z.enum(["L", "P"]),
  birthPlace: z.string().trim().min(2, "Isi tempat lahir.").max(60),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Isi tanggal lahir.").refine((d) => { const a = ageOf(d); return a >= 0 && a <= 120; }, "Tanggal lahir tidak valid."),
  phone,
});
export const step2 = z.object({
  province: z.string().trim().min(2, "Isi provinsi.").max(60),
  city: z.string().trim().min(2, "Isi kabupaten/kota.").max(60),
  district: z.string().trim().min(2, "Isi kecamatan.").max(60),
  village: z.string().trim().min(2, "Isi kelurahan/desa.").max(60),
  rt: text(4).optional(),
  rw: text(4).optional(),
  postal: z.string().regex(/^\d{5}$/, "Kode pos 5 digit."),
  address: z.string().trim().min(5, "Isi alamat lengkap.").max(200),
  landmark: text(100).optional(),
});
export const CONDITIONS = ["diabetes", "hipertensi", "jantung", "gangguan perdarahan", "hepatitis", "asma"] as const;
export const step3 = z.object({
  occupation: text(60).optional(),
  bloodType: z.enum(["", "A", "B", "AB", "O"]).default(""),
  marital: z.enum(["", "belum", "menikah", "cerai"]).default(""),
  allergies: text(200).optional(),
  conditions: z.array(z.enum(CONDITIONS)).max(10).default([]),
  conditionsOther: text(120).optional(),
  medications: text(200).optional(),
  pregnant: z.enum(["", "hamil", "menyusui"]).default(""),
  smoker: z.enum(["tidak", "kadang", "ya"]).default("tidak"),
  emName: z.string().trim().min(2, "Isi nama kontak darurat.").max(80),
  emRelation: z.string().trim().min(2, "Isi hubungan.").max(40),
  emPhone: phone,
});
export const credentials = z.object({ password: z.string().min(10, "Minimal 10 karakter.").max(200), consent: z.literal(true, { error: "Persetujuan diperlukan." }) });

type IdCheck = { idType: "wni" | "wna"; idNumber: string; birthDate: string; pregnant?: string; gender: string };
const idRules = (v: IdCheck, ctx: z.RefinementCtx) => {
  if (v.idType === "wni") {
    const e = validNik(v.idNumber, v.birthDate);
    if (e) ctx.addIssue({ code: "custom", path: ["idNumber"], message: e });
  } else if (!/^[A-Za-z0-9]{5,20}$/.test(v.idNumber)) ctx.addIssue({ code: "custom", path: ["idNumber"], message: "Nomor paspor tidak valid." });
  if (v.pregnant && v.gender !== "P") ctx.addIssue({ code: "custom", path: ["pregnant"], message: "Tidak sesuai." });
};

export const registerSchema = step1.extend(step2.shape).extend(step3.shape).extend(credentials.shape).extend({ captcha: z.string().nullish(), website: z.string().max(0).optional() }).superRefine(idRules);
export type RegisterInput = z.infer<typeof registerSchema>;

/** Registration by staff: email optional (an invite is sent when given), no password/consent/captcha; the patient is verified on the spot. */
export const staffPatientSchema = step1.extend({ email: z.union([z.literal(""), z.string().trim().email("Email tidak valid.").max(120)]).optional() }).extend(step2.shape).extend(step3.shape).extend({ force: z.boolean().optional() }).superRefine(idRules);
