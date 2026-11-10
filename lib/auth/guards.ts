import { db } from "@/lib/db/store";
import { randomToken } from "./crypto";
import { clientIp } from "./session";

const rlMem = new Map<string, { count: number; exp: number }>();

/** Fixed-window limiter on the shared store. Returns true while under the limit. */
export async function rateLimit(name: string, id: string, max: number, windowSec: number): Promise<boolean> {
  const k = `rl:${name}:${id}`;
  const now = Date.now();
  let local = rlMem.get(k);
  if (!local || local.exp <= now) {
    if (rlMem.size > 2000) rlMem.clear();
    local = { count: 0, exp: now + windowSec * 1000 };
    rlMem.set(k, local);
  }
  local.count += 1;
  if (local.count > max) return false;

  // High-volume read limiters (e.g. public doctors/slots/icd10) enforce in 0ms in-memory and sync with Redis in the background.
  if (max >= 30) {
    void db()
      .incr(k)
      .then((n) => {
        if (n === 1) void db().expire(k, windowSec).catch(() => null);
        if (local && n > local.count) local.count = n;
      })
      .catch(() => null);
    return true;
  }

  const n = await db().incr(k);
  if (n === 1) void db().expire(k, windowSec).catch(() => null);
  local.count = Math.max(local.count, n);
  return n <= max;
}
export async function failures(name: string, id: string) {
  return (await db().get<number>(`rl:${name}:${id}`)) ?? 0;
}
export const clearFailures = (name: string, id: string) => {
  rlMem.delete(`rl:${name}:${id}`);
  return db().del(`rl:${name}:${id}`);
};

/** reCAPTCHA v2 server-side check. Fails closed in production; skipped in dev when no secret is set. */
export async function verifyCaptcha(token: unknown): Promise<boolean> {
  const sec = process.env.RECAPTCHA_SECRET_KEY;
  if (!sec) return process.env.NODE_ENV !== "production";
  if (typeof token !== "string" || !token) return false;
  try {
    const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: sec, response: token, remoteip: await clientIp() }),
    });
    return Boolean(((await res.json()) as { success?: boolean }).success);
  } catch {
    return false;
  }
}

export async function audit(event: string, uid: string | null, meta: Record<string, unknown> = {}) {
  const e = { t: Date.now(), event, uid, ip: await clientIp(), ...meta };
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  await Promise.all([db().lpush(`audit:${day}`, e), uid ? db().lpush(`audit:user:${uid}`, e) : Promise.resolve()]);
}
export async function recentAudit(uid?: string, days = 3) {
  if (uid) return db().lrange<Record<string, unknown>>(`audit:user:${uid}`, 0, 49);
  const dates = Array.from({ length: days }, (_, i) => new Date(Date.now() - i * 86400000).toISOString().slice(0, 10).replace(/-/g, ""));
  const batches = await Promise.all(dates.map((d) => db().lrange<Record<string, unknown>>(`audit:${d}`, 0, 99)));
  return batches.flat().slice(0, 100);
}
export const newToken = randomToken;
