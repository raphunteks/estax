import { z } from "zod";
import { fail, json } from "@/lib/api";
import { audit, rateLimit } from "@/lib/auth/guards";
import { issueToken, maskName, verifyPatient } from "@/lib/clinic/public-booking";
import { clientIp } from "@/lib/redis";

const body = z.object({ ident: z.string().trim().min(4).max(20), birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), phone4: z.string().regex(/^\d{4}$/) });

/** Returning patient check: NIK or RM + birth date + last 4 phone digits. Returns only a masked name and a 15-minute token. */
export async function POST(req: Request) {
  const p = body.safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("validation", 400, "Periksa kembali data Anda.");
  const ip = clientIp(req);
  if (!(await rateLimit("pub-lookup-ip", ip, 8, 600)) || !(await rateLimit("pub-lookup-id", p.data.ident.replace(/\D/g, ""), 5, 3600))) return fail("rate_limited", 429, "Terlalu banyak percobaan. Coba lagi nanti.");
  const pat = await verifyPatient(p.data.ident, p.data.birthDate, p.data.phone4);
  if (!pat) return fail("not_found", 404, "Data tidak cocok. Periksa kembali atau daftar sebagai pasien baru.");
  await audit("public.lookup", null, { patient: pat.id });
  return json({ ok: true, token: await issueToken(pat.id), name: maskName(pat.name) });
}
