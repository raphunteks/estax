import { z } from "zod";
import { json, fail } from "@/lib/api";
import { checkPassword, findByEmail, twoFaRequired } from "@/lib/auth/users";
import { setPreAuth, startSession, clientIp } from "@/lib/auth/session";
import { audit, clearFailures, failures, rateLimit, verifyCaptcha } from "@/lib/auth/guards";
import { accountFor, homeFor } from "@/lib/auth/rbac";

const body = z.object({ email: z.string().email().max(120), password: z.string().min(1).max(200), captcha: z.string().nullish() });

export async function POST(req: Request) {
  const p = body.safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("validation");
  const ip = await clientIp();
  const email = p.data.email.trim().toLowerCase();

  if (!(await rateLimit("login-ip", ip, 20, 600))) return fail("rate_limited", 429);
  if ((await failures("login-fail", email)) >= 5) {
    await audit("login.locked", null, { email });
    return fail("locked", 429);
  }
  if (!(await verifyCaptcha(p.data.captcha))) return fail("captcha", 400);

  const user = await findByEmail(email);
  const ok = await checkPassword(user, p.data.password);
  if (!ok || !user || !user.active) {
    await rateLimit("login-fail", email, 5, 900);
    await audit("login.fail", user?.id ?? null, { email });
    return fail("invalid", 401); // same message for unknown email / wrong password / inactive
  }
  await clearFailures("login-fail", email);
  if (user.emailVerified === false) return fail("unverified", 403); // only revealed after the right password

  if (user.totpEnabled) {
    await setPreAuth(user.id);
    return json({ ok: true, step: "totp" });
  }
  await startSession(user.id);
  await audit("login.ok", user.id, { totp: false });
  const needs2fa = await twoFaRequired(user.role);
  return json({ ok: true, step: "done", next: user.mustChangePassword || needs2fa ? accountFor(user.role) : homeFor(user.role) });
}
