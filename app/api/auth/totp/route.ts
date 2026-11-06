import { z } from "zod";
import { json, fail } from "@/lib/api";
import { getUser, saveUser } from "@/lib/auth/users";
import { getPreAuth, startSession } from "@/lib/auth/session";
import { audit, clearFailures, failures, rateLimit } from "@/lib/auth/guards";
import { checkTotp, consumeBackupCode } from "@/lib/auth/totp";
import { accountFor, homeFor } from "@/lib/auth/rbac";

const body = z.object({ code: z.string().min(6).max(20) });

export async function POST(req: Request) {
  const p = body.safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("validation");
  const uid = await getPreAuth();
  if (!uid) return fail("expired", 401);
  if ((await failures("totp-fail", uid)) >= 5) return fail("locked", 429);

  const user = await getUser(uid);
  if (!user || !user.active || !user.totpEnabled) return fail("expired", 401);

  const code = p.data.code.trim();
  const step = /^\d{6}$/.test(code) ? await checkTotp(user, code) : null;
  let ok = step !== null;
  if (ok) {
    user.lastTotpStep = step as number; // replay protection: this step can never be used again
    await saveUser(user);
  } else if (!/^\d{6}$/.test(code)) {
    ok = await consumeBackupCode(user, code);
    if (ok) await audit("login.backup-code", user.id);
  }
  if (!ok) {
    await rateLimit("totp-fail", uid, 5, 900);
    await audit("totp.fail", uid);
    return fail("invalid", 401);
  }
  await clearFailures("totp-fail", uid);
  await startSession(user.id);
  await audit("login.ok", user.id, { totp: true });
  return json({ ok: true, next: user.mustChangePassword ? accountFor(user.role) : homeFor(user.role) });
}
