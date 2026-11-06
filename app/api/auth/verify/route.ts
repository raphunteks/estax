import { z } from "zod";
import { fail, json } from "@/lib/api";
import { audit, rateLimit, verifyCaptcha } from "@/lib/auth/guards";
import { clientIp } from "@/lib/auth/session";
import { randomToken, sha256 } from "@/lib/auth/crypto";
import { findByEmail, getUser, saveUser } from "@/lib/auth/users";
import { db } from "@/lib/db/store";
import { sendMail, siteUrl, verifyEmail } from "@/lib/mail";

const confirm = z.object({ token: z.string().min(20).max(100) });
const resend = z.object({ email: z.string().email().max(120), captcha: z.string().nullish() });

/** POST {token} confirms the email. */
export async function POST(req: Request) {
  const p = confirm.safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("validation");
  const key = `verify:${sha256(p.data.token)}`;
  if (!(await rateLimit("verify", await clientIp(), 20, 900))) return fail("rate_limited", 429);
  const uid = await db().get<string>(key);
  const u = uid ? await getUser(uid) : null;
  if (!u) return fail("invalid_token", 400);
  u.emailVerified = true;
  await saveUser(u);
  await db().del(key);
  await audit("email.verified", u.id);
  return json({ ok: true });
}

/** PUT {email} sends a fresh link. Same answer whether or not the account exists. */
export async function PUT(req: Request) {
  const p = resend.safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("validation");
  if (!(await rateLimit("verify-resend", await clientIp(), 5, 3600))) return fail("rate_limited", 429);
  if (!(await verifyCaptcha(p.data.captcha))) return fail("captcha");
  const u = await findByEmail(p.data.email);
  if (u && u.emailVerified === false && (await rateLimit("verify-resend-user", u.id, 3, 3600))) {
    const token = randomToken();
    await db().set(`verify:${sha256(token)}`, u.id, { ex: 24 * 3600 });
    const m = verifyEmail(`${siteUrl()}/verifikasi/${token}`, u.name);
    await sendMail(u.email, m.subject, m.html, m.text).catch(() => null);
  }
  return json({ ok: true });
}
