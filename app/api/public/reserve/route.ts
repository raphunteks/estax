import { z } from "zod";
import { fail, json } from "@/lib/api";
import { audit, rateLimit } from "@/lib/auth/guards";
import { createAppt, doctorsWithSchedule, isErr, validateSlot } from "@/lib/clinic/appointments";
import { createPatient, findDuplicate, getPatient } from "@/lib/clinic/patients";
import { tokenPatient } from "@/lib/clinic/public-booking";
import { clientIp } from "@/lib/redis";
import { normalizePhone, validNik } from "@/lib/nik";
import { getUser } from "@/lib/auth/users";

const common = {
  doctorId: z.string().min(3).max(40),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  complaint: z.string().trim().min(1, "Isi keluhan, atau tulis tanda minus (-) bila hanya kontrol.").max(300),
  consent: z.literal(true, { error: "Persetujuan diperlukan." }),
  website: z.string().max(500).optional(),
};
/** A lone dash or dot means "nothing to report". */
const blank = (v: string) => /^[\s\-–—.]+$/.test(v);
const body = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("lama"), token: z.string().min(10).max(64), ...common }),
  z.object({
    mode: z.literal("baru"),
    nik: z.string().regex(/^\d{16}$/, "NIK harus 16 digit."),
    name: z.string().trim().min(3, "Nama terlalu pendek.").max(80),
    birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Isi tanggal lahir."),
    gender: z.enum(["L", "P"]),
    phone: z.string().transform((v, c) => normalizePhone(v) ?? (c.addIssue({ code: "custom", message: "Nomor WhatsApp tidak valid." }), z.NEVER)),
    address: z.string().trim().min(5, "Isi alamat.").max(200),
    allergies: z.string().trim().min(1, "Isi alergi obat atau tulis Tidak ada.").max(200),
    ...common,
  }),
]);

/** Public reservation. Always creates a pending appointment ("menunggu"); staff confirm it. Never reveals existing patient data. */
export async function POST(req: Request) {
  const p = body.safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("validation", 400, p.error.issues[0]?.message ?? "Periksa kembali data Anda.");
  const d = p.data;
  if (d.website) return json({ ok: true }); // honeypot
  if (!(await rateLimit("pub-reserve", clientIp(req), 5, 600))) return fail("rate_limited", 429, "Terlalu banyak percobaan. Coba lagi beberapa menit lagi.");

  let patientId: string;
  if (d.mode === "lama") {
    const id = await tokenPatient(d.token);
    if (!id || !(await getPatient(id))) return fail("token", 401, "Verifikasi kedaluwarsa. Cari data pasien lagi.");
    patientId = id;
  } else {
    const nikErr = validNik(d.nik, d.birthDate);
    if (nikErr) return fail("validation", 400, nikErr);
    if (!(await rateLimit("pub-reserve-phone", d.phone, 3, 86400))) return fail("rate_limited", 429, "Terlalu banyak janji dari nomor ini hari ini. Hubungi klinik.");
    const input = { idType: "wni" as const, idNumber: d.nik, name: d.name, phone: d.phone, gender: d.gender, birthDate: d.birthDate, birthPlace: "-", address: d.address, allergies: blank(d.allergies) ? "Tidak ada" : d.allergies, conditions: [] };
    const dup = await findDuplicate(input); // an existing record is reused, never overwritten or disclosed
    patientId = dup ?? (await createPatient(input, {})).id;
  }

  // "any": first doctor that is free at that time.
  let doctorId = d.doctorId;
  if (doctorId === "any") {
    const docs = await doctorsWithSchedule();
    const free = [];
    for (const x of docs) if (!(await validateSlot(x.id, d.date, d.time, "public"))) free.push(x.id);
    if (!free.length) return fail("slot_taken", 409, "Jam tersebut sudah terisi. Pilih jam lain.");
    doctorId = free[0];
  }
  const r = await createAppt({ patientId, doctorId, date: d.date, time: d.time, payTypeId: "umum", complaint: blank(d.complaint) ? "Pemeriksaan umum" : d.complaint }, { id: "public", role: "publik" });
  if (isErr(r)) return fail(r.error, r.status, r.message);
  await audit("appt.public", null, { appt: r.id, mode: d.mode });
  return json({ ok: true, date: r.date, time: r.time, doctor: (await getUser(r.doctorId))?.name ?? "" }, 201);
}
