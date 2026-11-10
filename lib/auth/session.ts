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
  const [h, user, ip, jar, sec] = await Promise.all([headers(), getUser(uid), clientIp(), cookies(), isSecure()]);
  const role = user?.role;
  const { absolute } = getSessionDurations(role);

  const rec: SessionRec = {
    uid,
    role,
    created: Date.now(),
    last: Date.now(),
    ua: (h.get("user-agent") ?? "").slice(0, 160),
    ip,
  };

  sessionMem.set(sid, { rec, at: Date.now() });
  const [, , token] = await Promise.all([
    db().set(`session:${sid}`, rec, { ex: absolute }),
    db().sadd(`user:sessions:${uid}`, sid),
    sign({ sid }, absolute),
  ]);
  jar.set(COOKIE, token, {
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

const SESSION_MEM_TTL_MS = 2000;
const sessionMem = new Map<string, { rec: SessionRec | null; at: number }>();
const sessionInFlight = new Map<string, Promise<SessionRec | null>>();

function getCachedSessionRec(sid: string): Promise<SessionRec | null> {
  const now = Date.now();
  const hit = sessionMem.get(sid);
  if (hit && now - hit.at < SESSION_MEM_TTL_MS) return Promise.resolve(hit.rec);
  const pending = sessionInFlight.get(sid);
  if (pending) return pending;
  const task = db()
    .get<SessionRec>(`session:${sid}`)
    .then((rec) => {
      if (sessionMem.size > 500) sessionMem.clear();
      sessionMem.set(sid, { rec, at: Date.now() });
      return rec;
    })
    .finally(() => {
      sessionInFlight.delete(sid);
    });
  sessionInFlight.set(sid, task);
  return task;
}

/** Validates cookie + server-side session (revocable) + role-based idle timeout + active account. */
/** Memoised per request, so layout, page and guards share one lookup instead of repeating it. */
export const getAuth = cache(async (): Promise<Auth | null> => {
  const sid = await sidFromCookie();
  if (!sid) return null;
  const rec = await getCachedSessionRec(sid);
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
    const updated: SessionRec = { ...rec, role, last: Date.now() };
    sessionMem.set(sid, { rec: updated, at: Date.now() });
    void db().set(`session:${sid}`, updated, { ex: remainingSec }).catch(() => null);
  }

  return { user: toPublic(user), sid };
});

export async function endSessionById(sid: string, uid: string) {
  sessionMem.delete(sid);
  await Promise.all([db().del(`session:${sid}`), db().srem(`user:sessions:${uid}`, sid)]);
}
export async function endCurrentSession() {
  const sid = await sidFromCookie();
  if (sid) {
    sessionMem.delete(sid);
    const rec = await db().get<SessionRec>(`session:${sid}`);
    if (rec) await endSessionById(sid, rec.uid);
  }
  const jar = await cookies();
  jar.delete(COOKIE);
  jar.delete(PRE);
}
export async function listSessions(uid: string) {
  const ids = await db().smembers(`user:sessions:${uid}`);
  if (!ids.length) return [];
  const recs = await db().mget<SessionRec>(...ids.map((sid) => `session:${sid}`));
  const out: (SessionRec & { sid: string })[] = [];
  const stale: string[] = [];
  ids.forEach((sid, i) => {
    const r = recs[i];
    if (r) out.push({ ...r, sid });
    else stale.push(sid);
  });
  if (stale.length) await db().srem(`user:sessions:${uid}`, ...stale);
  return out.sort((a, b) => b.last - a.last);
}
export async function revokeSessions(uid: string, exceptSid?: string) {
  const ids = (await db().smembers(`user:sessions:${uid}`)).filter((sid) => sid !== exceptSid);
  ids.forEach((sid) => sessionMem.delete(sid));
  await Promise.all(ids.map((sid) => endSessionById(sid, uid)));
}
