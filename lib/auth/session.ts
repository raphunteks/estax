import { cache } from "react";
import { cookies, headers } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { db } from "@/lib/db/store";
import { randomId, secret } from "./crypto";
import { getUser, toPublic, type PublicUser } from "./users";

const COOKIE = "estaka_s";
const PRE = "estaka_pre";
const ABSOLUTE = 8 * 3600;
const IDLE = 30 * 60;
const key = () => new TextEncoder().encode(secret());
const secure = () => process.env.NODE_ENV === "production";

type SessionRec = { uid: string; created: number; last: number; ua: string; ip: string };

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "unknown";
}

async function sign(payload: Record<string, string>, ttl: number) {
  return new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setExpirationTime(`${ttl}s`).sign(key());
}

export async function startSession(uid: string) {
  const sid = randomId() + randomId();
  const h = await headers();
  const rec: SessionRec = { uid, created: Date.now(), last: Date.now(), ua: (h.get("user-agent") ?? "").slice(0, 160), ip: await clientIp() };
  await db().set(`session:${sid}`, rec, { ex: ABSOLUTE });
  await db().sadd(`user:sessions:${uid}`, sid);
  const jar = await cookies();
  jar.set(COOKIE, await sign({ sid }, ABSOLUTE), { httpOnly: true, secure: secure(), sameSite: "lax", path: "/", maxAge: ABSOLUTE });
  jar.delete(PRE);
}

export async function setPreAuth(uid: string) {
  (await cookies()).set(PRE, await sign({ uid }, 300), { httpOnly: true, secure: secure(), sameSite: "lax", path: "/", maxAge: 300 });
}
export async function getPreAuth(): Promise<string | null> {
  const t = (await cookies()).get(PRE)?.value;
  if (!t) return null;
  try {
    return ((await jwtVerify(t, key())).payload.uid as string) ?? null;
  } catch {
    return null;
  }
}

async function sidFromCookie(): Promise<string | null> {
  const t = (await cookies()).get(COOKIE)?.value;
  if (!t) return null;
  try {
    return ((await jwtVerify(t, key())).payload.sid as string) ?? null;
  } catch {
    return null;
  }
}

export type Auth = { user: PublicUser; sid: string };

/** Validates cookie + server-side session (revocable) + idle timeout + active account. */
/** Memoised per request, so layout, page and guards share one lookup instead of repeating it. */
export const getAuth = cache(async (): Promise<Auth | null> => {
  const sid = await sidFromCookie();
  if (!sid) return null;
  const rec = await db().get<SessionRec>(`session:${sid}`);
  if (!rec || Date.now() - rec.last > IDLE * 1000) {
    if (rec) await endSessionById(sid, rec.uid);
    return null;
  }
  const user = await getUser(rec.uid);
  if (!user || !user.active) return null;
  if (Date.now() - rec.last > 60_000) await db().set(`session:${sid}`, { ...rec, last: Date.now() }, { ex: ABSOLUTE });
  return { user: toPublic(user), sid };
});

export async function endSessionById(sid: string, uid: string) {
  await db().del(`session:${sid}`);
  await db().srem(`user:sessions:${uid}`, sid);
}
export async function endCurrentSession() {
  const sid = await sidFromCookie();
  if (sid) {
    const rec = await db().get<SessionRec>(`session:${sid}`);
    if (rec) await endSessionById(sid, rec.uid);
  }
  const jar = await cookies();
  jar.delete(COOKIE);
  jar.delete(PRE);
}
export async function listSessions(uid: string) {
  const ids = await db().smembers(`user:sessions:${uid}`);
  const out: (SessionRec & { sid: string })[] = [];
  for (const sid of ids) {
    const r = await db().get<SessionRec>(`session:${sid}`);
    if (r) out.push({ ...r, sid });
    else await db().srem(`user:sessions:${uid}`, sid);
  }
  return out.sort((a, b) => b.last - a.last);
}
export async function revokeSessions(uid: string, exceptSid?: string) {
  for (const sid of await db().smembers(`user:sessions:${uid}`)) if (sid !== exceptSid) await endSessionById(sid, uid);
}
