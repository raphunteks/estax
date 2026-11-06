import { generateRegistrationOptions } from "@simplewebauthn/server";
import { fail, isResponse, json, requireAuth } from "@/lib/api";
import { rateLimit } from "@/lib/auth/guards";
import { db } from "@/lib/db/store";
import { passkeysOf, rp } from "@/lib/passkey";

export async function POST(req: Request) {
  const a = await requireAuth();
  if (isResponse(a)) return a;
  if (!(await rateLimit("pk-reg", a.user.id, 20, 3600))) return fail("rate_limited", 429);
  const r = rp(req);
  if (!r) return fail("config", 500, "NEXT_PUBLIC_SITE_URL belum diatur.");
  const keys = await passkeysOf(a.user.id);
  if (keys.length >= 5) return fail("limit", 409, "Maksimal 5 passkey.");
  const options = await generateRegistrationOptions({
    rpName: r.name, rpID: r.id, userName: a.user.email, userDisplayName: a.user.name, userID: new TextEncoder().encode(a.user.id),
    excludeCredentials: keys.map((k) => ({ id: k.id, transports: k.transports })),
    authenticatorSelection: { residentKey: "required", userVerification: "required" },
  });
  await db().set(`pkc:reg:${a.user.id}`, options.challenge, { ex: 300 });
  return json({ ok: true, options });
}
