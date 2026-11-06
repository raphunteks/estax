import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { fail, json } from "@/lib/api";
import { rateLimit } from "@/lib/auth/guards";
import { clientIp } from "@/lib/auth/session";
import { randomId } from "@/lib/auth/crypto";
import { db } from "@/lib/db/store";
import { rp } from "@/lib/passkey";

/** Discoverable-credential login: no username needed. The challenge is bound to a one-time token. */
export async function POST(req: Request) {
  if (!(await rateLimit("pk-login-opt", await clientIp(), 60, 600))) return fail("rate_limited", 429);
  const r = rp(req);
  if (!r) return fail("config", 500);
  const options = await generateAuthenticationOptions({ rpID: r.id, userVerification: "required" });
  const token = randomId();
  await db().set(`pkc:login:${token}`, options.challenge, { ex: 300 });
  return json({ ok: true, options, token });
}
