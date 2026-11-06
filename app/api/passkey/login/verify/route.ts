import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { z } from "zod";
import { fail, json } from "@/lib/api";
import { audit, rateLimit } from "@/lib/auth/guards";
import { accountFor, homeFor } from "@/lib/auth/rbac";
import { clientIp, startSession } from "@/lib/auth/session";
import { getUser, twoFaRequired } from "@/lib/auth/users";
import { db } from "@/lib/db/store";
import { ownerOf, passkeysOf, rp, savePasskeys, unb64 } from "@/lib/passkey";

const body = z.object({ token: z.string().min(10).max(80), response: z.record(z.string(), z.unknown()) });
export async function POST(req: Request) {
  if (!(await rateLimit("pk-login", await clientIp(), 30, 600))) return fail("rate_limited", 429);
  const p = body.safeParse(await req.json().catch(() => null));
  const r = rp(req);
  if (!p.success || !r) return fail("validation");
  const key = `pkc:login:${p.data.token}`;
  const challenge = await db().get<string>(key);
  if (!challenge) return fail("expired", 400, "Permintaan kedaluwarsa. Coba lagi.");
  await db().del(key);
  const resp = p.data.response as unknown as AuthenticationResponseJSON;
  const uid = typeof resp.id === "string" ? await ownerOf(resp.id) : null;
  const user = uid ? await getUser(uid) : null;
  const keys = user ? await passkeysOf(user.id) : [];
  const k = keys.find((x) => x.id === resp.id);
  if (!user || !k || !user.active || user.emailVerified === false) return fail("invalid", 401, "Passkey tidak dikenali.");
  // A passkey replaces the password, never the second factor of accounts that use or require one.
  if (user.totpEnabled || (await twoFaRequired(user.role))) return fail("use_password", 403, "Akun ini wajib login dengan sandi dan 2FA.");
  try {
    const v = await verifyAuthenticationResponse({ response: resp, expectedChallenge: challenge, expectedOrigin: r.origin, expectedRPID: r.id, credential: { id: k.id, publicKey: unb64(k.publicKey), counter: k.counter, transports: k.transports }, requireUserVerification: true });
    if (!v.verified) return fail("invalid", 401, "Passkey tidak dapat diverifikasi.");
    k.counter = v.authenticationInfo.newCounter;
  } catch {
    return fail("invalid", 401, "Passkey tidak dapat diverifikasi.");
  }
  k.lastUsedAt = Date.now();
  await savePasskeys(user.id, keys);
  await startSession(user.id);
  await audit("login.ok", user.id, { passkey: true });
  return json({ ok: true, step: "done", next: user.mustChangePassword ? accountFor(user.role) : homeFor(user.role) });
}
