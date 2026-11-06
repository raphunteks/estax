import "server-only";
import { db } from "@/lib/db/store";

export type Passkey = { id: string; publicKey: string; counter: number; transports?: string[]; name: string; createdAt: number; lastUsedAt?: number };
const lk = (uid: string) => `pk:${uid}`;
export const passkeysOf = async (uid: string) => ((await db().get<Passkey[]>(lk(uid))) ?? []) as Passkey[];
export const savePasskeys = (uid: string, v: Passkey[]) => db().set(lk(uid), v);
export const ownerOf = (credId: string) => db().get<string>(`pk:id:${credId}`);
export const claimCred = (credId: string, uid: string) => db().set(`pk:id:${credId}`, uid);
export const dropCred = (credId: string) => db().del(`pk:id:${credId}`);

/** Relying party from the public site URL; on localhost the request origin is used so dev works. */
export function rp(req: Request) {
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  const o = req.headers.get("origin");
  try {
    if (o && new URL(o).hostname === "localhost") return { id: "localhost", origin: o, name: "Estaka Dental Clinic" };
    if (site) { const u = new URL(site); return { id: u.hostname, origin: u.origin, name: "Estaka Dental Clinic" }; }
  } catch { /* fall through */ }
  return null;
}
export const b64 = (u: Uint8Array) => Buffer.from(u).toString("base64url");
export const unb64 = (s: string) => new Uint8Array(Buffer.from(s, "base64url"));
