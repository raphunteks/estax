import { fail, json } from "@/lib/api";
import { audit, rateLimit, verifyCaptcha } from "@/lib/auth/guards";
import { clientIp } from "@/lib/auth/session";
import { randomToken, sha256 } from "@/lib/auth/crypto";
import { createUser, findByEmail, passwordProblem } from "@/lib/auth/users";
import { db } from "@/lib/db/store";
import { createPatient } from "@/lib/clinic/patients";
import { registerSchema } from "@/lib/patient-schema";
import { sendMail, siteUrl, verifyEmail } from "@/lib/mail";

/** Self-registration of a patient. Always answers the same way for a taken email so accounts cannot be enumerated. */
export async function POST(req: Request) {
  const raw = await req.json().catch(() => null);
  if (raw && typeof raw === "object" && (raw as { website?: unknown }).website) return json({ ok: true }); // honeypot: pretend success
  const p = registerSchema.safeParse(raw);
  if (!p.success) return fail("validation", 400, p.error.issues[0]?.message);
  const ip = await clientIp();
  if (!(await rateLimit("register-ip", ip, 5, 3600))) return fail("rate_limited", 429);
  if (!(await verifyCaptcha(p.data.captcha))) return fail("captcha");
  const v = p.data;
  const problem = passwordProblem(v.password, v.email);
  if (problem) return fail("weak_password", 400, problem);

  if (!(await findByEmail(v.email))) {
    const u = await createUser({ email: v.email, name: v.name, role: "pasien", password: v.password, mustChangePassword: false, emailVerified: false });
    const pat = await createPatient(v, { userId: u.id });
    const dup = pat.duplicateOf;
    const token = randomToken();
    await db().set(`verify:${sha256(token)}`, u.id, { ex: 24 * 3600 });
    const m = verifyEmail(`${siteUrl()}/verifikasi/${token}`, u.name);
    await sendMail(u.email, m.subject, m.html, m.text).catch(() => audit("register.mail-failed", u.id));
    await audit("patient.registered", u.id, dup ? { duplicateOf: dup } : {});
  }
  return json({ ok: true });
}
