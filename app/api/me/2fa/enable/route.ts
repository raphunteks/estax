import { z } from "zod";
import { json, fail, isResponse, requireAuth } from "@/lib/api";
import { getUser, saveUser } from "@/lib/auth/users";
import { checkTotp, makeBackupCodes } from "@/lib/auth/totp";
import { audit, rateLimit } from "@/lib/auth/guards";
import { db } from "@/lib/db/store";

const body = z.object({ code: z.string().regex(/^\d{6}$/) });

export async function POST(req: Request) {
  const a = await requireAuth({ allowLocked: true });
  if (isResponse(a)) return a;
  const p = body.safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("validation");
  if (!(await rateLimit("2fa-enable", a.user.id, 8, 600))) return fail("rate_limited", 429);
  const user = await getUser(a.user.id);
  const enc = await db().get<string>(`totp:pending:${a.user.id}`);
  if (!user || !enc) return fail("expired", 400);

  const trial = { ...user, totpSecretEnc: enc, lastTotpStep: 0 };
  const step = await checkTotp(trial, p.data.code);
  if (step === null) return fail("invalid", 401);

  const { codes, hashes } = makeBackupCodes();
  user.totpSecretEnc = enc;
  user.totpEnabled = true;
  user.lastTotpStep = step;
  user.backupHashes = hashes;
  await saveUser(user);
  await db().del(`totp:pending:${a.user.id}`);
  await audit("2fa.enabled", user.id);
  return json({ ok: true, backupCodes: codes }); // shown once
}
