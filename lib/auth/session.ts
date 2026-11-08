import { cache } from "react";
import { cookies, headers } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { db } from "@/lib/db/store";
import { randomId, secret } from "./crypto";
import { getUser, toPublic, type PublicUser } from "./users";

const COOKIE = "estaka_s";
const PRE = "estaka_pre";

// Role-based session durations (seconds)
// Staf / Dokter / Kasir / Superadmin: Idle 4 jam, Absolute 24 jam (shift kerja klinik)
const STAFF_IDLE = 4 * 3600; // 4 hours = 14,400s
const STAFF_ABSOLUTE = 24 * 3600; // 24 hours = 86,400s

// Pasien: Idle 30 hari, Absolute 30 hari (PWA / Mobile patient experience)
const PATIENT_IDLE = 30 * 86400; // 30 days = 2,592,000s
const PATIENT_ABSOLUTE = 30 * 86400; // 30 days = 2,592,000s

export function getSessionDurations(role?: string) {
  if (role === "pasien") {
    return { idle: PATIENT_IDLE, absolute: PATIENT_ABSOLUTE };
  }
  return { idle: STAFF_IDLE, absolute: STAFF_ABSOLUTE };
}

const key = () => new TextEncoder().encode(secret());
const isSecure = async () => {
  if (process.env.VERCEL) return true;
  try {
    const h = await headers();
    const proto = h.get("x-forwarded-proto");
    if (proto === "https") return true;
    const host = h.get("host") || h.get("x-forwarded-host");
    if (host && (host.includes("localhost") || host.includes("127.0.0.1"))) return false;
  } catch {
    // fallback
  }
  return process.env.NODE_ENV === "production";
};

type SessionRec = { uid: string; role?: string; created: number; last: number; ua: string; ip: string };

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
  const user = await getUser(uid);
  const role = user?.role;
  const { absolute } = getSessionDurations(role);

  const rec: SessionRec = {
    uid,
    role,
    created: Date.now(),
    last: Date.now(),
    ua: (h.get("user-agent") ?? "").slice(0, 160),
    ip: await clientIp(),
  };

  await db().set(`session:${sid}`, rec, { ex: absolute });
  await db().sadd(`user:sessions:${uid}`, sid);
  const jar = await cookies();
  const sec = await isSecure();
  jar.set(COOKIE, await sign({ sid }, absolute), {
    httpOnly: true,
    secure: sec,
    sameSite: "lax",
    path: "/",
    maxAge: absolute,
  });
  jar.delete(PRE);
}

export async function setPreAuth(uid: string) {
  const sec = await isSecure();
  (await cookies()).set(PRE, await sign({ uid }, 300), { httpOnly: true, secure: sec, sameSite: "lax", path: "/", maxAge: 300 });
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

/** Validates cookie + server-side session (revocable) + role-based idle timeout + active account. */
/** Memoised per request, so layout, page and guards share one lookup instead of repeating it. */
export const getAuth = cache(async (): Promise<Auth | null> => {
  const sid = await sidFromCookie();
  if (!sid) return null;
  const rec = await db().get<SessionRec>(`session:${sid}`);
  if (!rec) return null;

  const user = await getUser(rec.uid);
  if (!user || !user.active) return null;

  const role = rec.role ?? user.role;
  const { idle, absolute } = getSessionDurations(role);

  // Check absolute timeout (max session lifespan)
  const elapsedSec = (Date.now() - rec.created) / 1000;
  if (elapsedSec > absolute) {
    await endSessionById(sid, rec.uid);
    return null;
  }

  // Check idle timeout (inactivity threshold)
  if (Date.now() - rec.last > idle * 1000) {
    await endSessionById(sid, rec.uid);
    return null;
  }

  // Slide last-active timestamp if > 60s, keeping Redis TTL bounded by remaining absolute time
  if (Date.now() - rec.last > 60_000) {
    const remainingSec = Math.max(60, Math.floor(absolute - elapsedSec));
    await db().set(`session:${sid}`, { ...rec, role, last: Date.now() }, { ex: remainingSec });
  }

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
