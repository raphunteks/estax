import "server-only";
import webpush from "web-push";
import { randomId, sha256 } from "@/lib/auth/crypto";
import { listUsers } from "@/lib/auth/users";
import { db } from "@/lib/db/store";

/** Web Push + per-user inbox. VAPID keys come from env in production; in dev a pair is generated once and kept in the dev store. */
type Vapid = { pub: string; priv: string; subject: string };
let cached: Vapid | null | undefined;
async function vapid(): Promise<Vapid | null> {
  if (cached !== undefined) return cached;
  const subject = process.env.VAPID_SUBJECT || `mailto:${process.env.SMTP_USER || "sentrovahelp@gmail.com"}`;
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return (cached = { pub: process.env.VAPID_PUBLIC_KEY, priv: process.env.VAPID_PRIVATE_KEY, subject });
  }
  try {
    let k = await db().get<{ pub: string; priv: string }>("push:vapid");
    if (!k || !k.pub || !k.priv) {
      const g = webpush.generateVAPIDKeys();
      k = { pub: g.publicKey, priv: g.privateKey };
      await db().set("push:vapid", k);
    }
    return (cached = { ...k, subject });
  } catch (e) {
    console.error("VAPID store lookup/generation error:", e);
    return null;
  }
}
export const publicKey = async () => (await vapid())?.pub ?? null;

type Sub = { endpoint: string; keys: { p256dh: string; auth: string } };
const sk = (h: string) => `push:s:${h}`;
const uk = (u: string) => `push:u:${u}`;
export async function subscribe(userId: string, sub: Sub) {
  const h = sha256(sub.endpoint);
  await db().set(sk(h), { userId, sub });
  await db().sadd(uk(userId), h);
}
export async function unsubscribe(userId: string, endpoint: string) {
  const h = sha256(endpoint);
  await db().del(sk(h));
  await db().srem(uk(userId), h);
}

export type Msg = { title: string; body: string; url?: string; tag?: string };
export type InboxItem = Msg & { id: string; t: number };
const ik = (u: string) => `inbox:${u}`;
export const inbox = (userId: string) => db().lrange<InboxItem>(ik(userId), 0, 29);

/** Stores the message in the user's inbox and pushes it to every registered device. Never throws. */
export async function notifyUser(userId: string, m: Msg): Promise<number> {
  try {
    await db().lpush(ik(userId), { ...m, id: randomId().slice(0, 10), t: Date.now() } satisfies InboxItem);
    const v = await vapid();
    if (!v) return 0;
    webpush.setVapidDetails(v.subject, v.pub, v.priv);
    let sent = 0;
    for (const h of await db().smembers(uk(userId))) {
      const rec = await db().get<{ sub: Sub }>(sk(h));
      if (!rec) { await db().srem(uk(userId), h); continue; }
      try {
        await webpush.sendNotification(rec.sub, JSON.stringify({ ...m, url: m.url ?? "/" }), { TTL: 3600, urgency: "high" });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) { await db().del(sk(h)); await db().srem(uk(userId), h); }
      }
    }
    return sent;
  } catch {
    return 0;
  }
}
export async function notifyRole(role: string, m: Msg) {
  const users = (await listUsers()).filter((u) => u.role === role && u.active);
  return (await Promise.all(users.map((u) => notifyUser(u.id, m)))).reduce((a, b) => a + b, 0);
}
