import { verifyRegistrationResponse } from "@simplewebauthn/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { z } from "zod";
import { fail, isResponse, json, requireAuth } from "@/lib/api";
import { audit } from "@/lib/auth/guards";
import { db } from "@/lib/db/store";
import { b64, claimCred, passkeysOf, rp, savePasskeys } from "@/lib/passkey";

const body = z.object({ response: z.record(z.string(), z.unknown()), name: z.string().trim().max(40).optional() });
export async function POST(req: Request) {
  const a = await requireAuth();
  if (isResponse(a)) return a;
  const p = body.safeParse(await req.json().catch(() => null));
  const r = rp(req);
  if (!p.success || !r) return fail("validation");
  const key = `pkc:reg:${a.user.id}`;
  const challenge = await db().get<string>(key);
  if (!challenge) return fail("expired", 400, "Permintaan kedaluwarsa. Coba lagi.");
  await db().del(key); // one shot
  let v;
  try {
    v = await verifyRegistrationResponse({ response: p.data.response as unknown as RegistrationResponseJSON, expectedChallenge: challenge, expectedOrigin: r.origin, expectedRPID: r.id, requireUserVerification: true });
  } catch {
    return fail("verify", 400, "Passkey tidak dapat diverifikasi.");
  }
  if (!v.verified) return fail("verify", 400, "Passkey tidak dapat diverifikasi.");
  const c = v.registrationInfo.credential;
  const keys = await passkeysOf(a.user.id);
  if (keys.length >= 5 || keys.some((k) => k.id === c.id)) return fail("limit", 409);
  keys.push({ id: c.id, publicKey: b64(c.publicKey), counter: c.counter, transports: c.transports, name: p.data.name || "Perangkat ini", createdAt: Date.now() });
  await savePasskeys(a.user.id, keys);
  await claimCred(c.id, a.user.id);
  await audit("passkey.added", a.user.id);
  return json({ ok: true }, 201);
}
