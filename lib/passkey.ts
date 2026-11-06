import "server-only";
import { db } from "@/lib/db/store";
import { getRelyingParty } from "@/lib/origin";

export type Passkey = { id: string; publicKey: string; counter: number; transports?: string[]; name: string; createdAt: number; lastUsedAt?: number };
const lk = (uid: string) => `pk:${uid}`;
export const passkeysOf = async (uid: string) => ((await db().get<Passkey[]>(lk(uid))) ?? []) as Passkey[];
export const savePasskeys = (uid: string, v: Passkey[]) => db().set(lk(uid), v);
export const ownerOf = (credId: string) => db().get<string>(`pk:id:${credId}`);
export const claimCred = (credId: string, uid: string) => db().set(`pk:id:${credId}`, uid);
export const dropCred = (credId: string) => db().del(`pk:id:${credId}`);

/** Relying party dynamically resolved from request headers, Vercel env, or fallback. */
export function rp(req?: Request | Headers | null) {
  return getRelyingParty(req);
}
export const b64 = (u: Uint8Array) => Buffer.from(u).toString("base64url");
export const unb64 = (s: string) => new Uint8Array(Buffer.from(s, "base64url"));
