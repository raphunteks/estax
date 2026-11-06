import { z } from "zod";
import { json, fail, isResponse, requireAuth } from "@/lib/api";
import { checkPassword, getUser, saveUser, twoFaRequired } from "@/lib/auth/users";
import { checkTotp } from "@/lib/auth/totp";
import { audit, rateLimit } from "@/lib/auth/guards";

const body = z.object({ password: z.string().min(1).max(200), code: z.string().regex(/^\d{6}$/) });

export async function POST(req: Request) {
  const a = await requireAuth({ allowLocked: true });
  if (isResponse(a)) return a;
  const p = body.safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("validation");
  if (!(await rateLimit("2fa-disable", a.user.id, 5, 900))) return fail("rate_limited", 429);
  if (await twoFaRequired(a.user.role)) return fail("required", 403, "2FA wajib untuk peran Anda.");
  const user = await getUser(a.user.id);
  if (!user || !(await checkPassword(user, p.data.password)) || (await checkTotp(user, p.data.code)) === null) return fail("invalid", 401);
  user.totpEnabled = false;
  user.totpSecretEnc = undefined;
  user.backupHashes = [];
  await saveUser(user);
  await audit("2fa.disabled", user.id);
  return json({ ok: true });
}
