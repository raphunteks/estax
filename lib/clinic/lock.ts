import { db } from "@/lib/db/store";
import { randomId } from "@/lib/auth/crypto";

/** Short mutex on a key (SET NX + TTL). Protects read-modify-write on invoices and stock; fails fast instead of queueing. */
export async function withLock<T>(name: string, fn: () => Promise<T>): Promise<T | { busy: true }> {
  const k = `lock:${name}`;
  const token = randomId();
  if (!(await db().set(k, token, { nx: true, ex: 8 }))) return { busy: true };
  try {
    return await fn();
  } finally {
    if ((await db().get<string>(k)) === token) await db().del(k);
  }
}
export const isBusy = (x: unknown): x is { busy: true } => typeof x === "object" && x !== null && "busy" in x;
