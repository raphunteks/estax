import { z } from "zod";
import { json, fail } from "@/lib/api";
import { findByEmail } from "@/lib/auth/users";
import { clientIp } from "@/lib/auth/session";
import { audit, rateLimit, verifyCaptcha } from "@/lib/auth/guards";
import { randomToken, sha256 } from "@/lib/auth/crypto";
import { db } from "@/lib/db/store";
import { resetEmail, sendMail, siteUrl } from "@/lib/mail";

const body = z.object({ email: z.string().email().max(120), captcha: z.string().nullish() });

export async function POST(req: Request) {
  const p = body.safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("validation");
  const ip = await clientIp();
  if (!(await rateLimit("forgot-ip", ip, 5, 900))) return fail("rate_limited", 429);
  if (!(await verifyCaptcha(p.data.captcha))) return fail("captcha");

  const user = await findByEmail(p.data.email);
  if (user?.active && (await rateLimit("forgot-user", user.id, 3, 3600))) {
    const token = randomToken();
    await db().set(`reset:${sha256(token)}`, user.id, { ex: 3600 });
    const m = resetEmail(`${siteUrl()}/atur-sandi/${token}`);
    try {
      await sendMail(user.email, m.subject, m.html, m.text);
      await audit("reset.requested", user.id);
    } catch {
      await audit("reset.mail-failed", user.id);
    }
  }
  return json({ ok: true }); // always the same answer: no account enumeration
}
