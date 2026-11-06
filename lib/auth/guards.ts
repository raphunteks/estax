import { db } from "@/lib/db/store";
import { randomToken } from "./crypto";
import { clientIp } from "./session";

/** Fixed-window limiter on the shared store. Returns true while under the limit. */
export async function rateLimit(name: string, id: string, max: number, windowSec: number): Promise<boolean> {
  const k = `rl:${name}:${id}`;
  const n = await db().incr(k);
  if (n === 1) await db().expire(k, windowSec);
  return n <= max;
}
export async function failures(name: string, id: string) {
  return (await db().get<number>(`rl:${name}:${id}`)) ?? 0;
}
export const clearFailures = (name: string, id: string) => db().del(`rl:${name}:${id}`);

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
  await db().lpush(`audit:${day}`, e);
  if (uid) await db().lpush(`audit:user:${uid}`, e);
}
export async function recentAudit(uid?: string, days = 3) {
  if (uid) return db().lrange<Record<string, unknown>>(`audit:user:${uid}`, 0, 49);
  const out: Record<string, unknown>[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10).replace(/-/g, "");
    out.push(...(await db().lrange<Record<string, unknown>>(`audit:${d}`, 0, 99)));
  }
  return out.slice(0, 100);
}
export const newToken = randomToken;
