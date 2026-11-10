import { Redis } from "@upstash/redis";
import fs from "node:fs";
import { broadcastRev } from "../realtime-server";

/**
 * Minimal key-value surface used by the whole app (Upstash Redis in production).
 * Without Upstash env vars, a file-backed in-memory store is used for LOCAL DEV ONLY; production refuses to start without Redis.
 */
export interface Store {
  get<T = unknown>(k: string): Promise<T | null>;
  mget<T = unknown>(...k: string[]): Promise<(T | null)[]>;
  set(k: string, v: unknown, o?: { ex?: number; nx?: boolean }): Promise<boolean>;
  del(...k: string[]): Promise<void>;
  incr(k: string): Promise<number>;
  expire(k: string, s: number): Promise<void>;
  sadd(k: string, ...m: string[]): Promise<void>;
  srem(k: string, ...m: string[]): Promise<void>;
  smembers(k: string): Promise<string[]>;
  lpush(k: string, v: unknown): Promise<void>;
  lrange<T = unknown>(k: string, a: number, b: number): Promise<T[]>;
  /** Backup: every persistent key (no TTL = not a session, rate limit, lock or one-time token). */
  dump(): Promise<DumpEntry[]>;
  /** Restore: overwrite the given keys; keys not in the list are left alone. */
  restore(entries: DumpEntry[]): Promise<number>;
}
export type DumpEntry = { k: string; t: "value" | "set" | "list"; v: unknown };

const FILE = ".dev-db.json";
type Entry = { v: unknown; exp?: number };

function memoryStore(): Store {
  let data: Record<string, Entry> = {};
  try {
    data = JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    /* fresh */
  }
  // Dev only: route handlers and server components can run in separate module instances, so re-read the file when it changed.
  let seen = 0;
  const refresh = () => {
    try {
      const m = fs.statSync(FILE).mtimeMs;
      if (m !== seen) {
        data = JSON.parse(fs.readFileSync(FILE, "utf8"));
        seen = m;
      }
    } catch {
      /* no file yet */
    }
  };
  const save = () => {
    try {
      fs.writeFileSync(FILE, JSON.stringify(data));
      seen = fs.statSync(FILE).mtimeMs;
    } catch {
      /* ignore */
    }
  };
  const live = (k: string): Entry | undefined => {
    refresh();
    const e = data[k];
    if (e?.exp && e.exp < Date.now()) {
      delete data[k];
      return undefined;
    }
    return e;
  };
  const arr = (k: string) => (live(k)?.v as unknown[] | undefined) ?? [];
  return {
    async get<T>(k: string) {
      return (live(k)?.v as T) ?? null;
    },
    async mget<T>(...ks: string[]) {
      if (!ks.length) return [];
      refresh();
      return ks.map((k) => {
        const e = data[k];
        if (e?.exp && e.exp < Date.now()) {
          delete data[k];
          return null;
        }
        return (e?.v as T) ?? null;
      });
    },
    async set(k, v, o) {
      if (o?.nx && live(k)) return false;
      refresh();
      data[k] = { v: structuredClone(v), exp: o?.ex ? Date.now() + o.ex * 1000 : undefined };
      save();
      return true;
    },
    async del(...ks) {
      refresh();
      ks.forEach((k) => delete data[k]);
      save();
    },
    async incr(k) {
      const e = live(k);
      const n = ((e?.v as number) ?? 0) + 1;
      data[k] = { v: n, exp: e?.exp };
      save();
      return n;
    },
    async expire(k, s) {
      const e = live(k);
      if (e) e.exp = Date.now() + s * 1000;
      save();
    },
    async sadd(k, ...m) {
      data[k] = { v: [...new Set([...arr(k), ...m])], exp: live(k)?.exp };
      save();
    },
    async srem(k, ...m) {
      data[k] = { v: arr(k).filter((x) => !m.includes(x as string)), exp: live(k)?.exp };
      save();
    },
    async smembers(k) {
      return arr(k) as string[];
    },
    async lpush(k, v) {
      data[k] = { v: [structuredClone(v), ...arr(k)].slice(0, 5000), exp: live(k)?.exp };
      save();
    },
    async lrange<T>(k: string, a: number, b: number) {
      return arr(k).slice(a, b < 0 ? undefined : b + 1) as T[];
    },
    async dump() {
      refresh();
      return Object.keys(data).filter((k) => live(k) && !data[k]?.exp).map((k) => ({ k, t: Array.isArray(data[k].v) ? ("list" as const) : ("value" as const), v: structuredClone(data[k].v) }));
    },
    async restore(entries) {
      refresh();
      for (const e of entries) data[e.k] = { v: structuredClone(e.v) };
      save();
      return entries.length;
    },
  };
}

function upstashStore(r: Redis): Store {
  return {
    get: (k) => r.get(k) as never,
    async mget<T>(...ks: string[]) {
      if (!ks.length) return [];
      if (ks.length === 1) return [((await r.get(ks[0])) as T | null) ?? null];
      const out: (T | null)[] = [];
      for (let i = 0; i < ks.length; i += 400) {
        const res = await r.mget<(T | null)[]>(...ks.slice(i, i + 400));
        out.push(...res.map((v) => v ?? null));
      }
      return out;
    },
    async set(k, v, o) {
      const res = await r.set(k, v as never, ({ ...(o?.ex ? { ex: o.ex } : {}), ...(o?.nx ? { nx: true } : {}) } as never));
      return res !== null;
    },
    async del(...k) {
      if (k.length) await r.del(...k);
    },
    incr: (k) => r.incr(k),
    async expire(k, s) {
      await r.expire(k, s);
    },
    async sadd(k, ...m) {
      if (m.length) await r.sadd(k, m as [string, ...string[]]);
    },
    async srem(k, ...m) {
      if (m.length) await r.srem(k, ...(m as [string, ...string[]]));
    },
    smembers: (k) => r.smembers(k),
    async lpush(k, v) {
      await r.lpush(k, v as never);
    },
    lrange: (k, a, b) => r.lrange(k, a, b) as never,
    async dump() {
      const keys: string[] = [];
      let cur: string | number = 0;
      do {
        const [next, batch]: [string | number, string[]] = await r.scan(cur, { count: 500 });
        keys.push(...batch);
        cur = next;
      } while (String(cur) !== "0");
      const out: DumpEntry[] = [];
      for (let i = 0; i < keys.length; i += 40) {
        const part = await Promise.all(
          keys.slice(i, i + 40).map(async (k): Promise<DumpEntry | null> => {
            if ((await r.ttl(k)) !== -1) return null;
            const t = await r.type(k);
            if (t === "set") return { k, t: "set", v: await r.smembers(k) };
            if (t === "list") return { k, t: "list", v: await r.lrange(k, 0, -1) };
            if (t === "string") return { k, t: "value", v: await r.get(k) };
            return null;
          }),
        );
        out.push(...part.filter((x): x is DumpEntry => x !== null));
      }
      return out;
    },
    async restore(entries) {
      for (const e of entries) {
        if (e.t === "set") {
          await r.del(e.k);
          const m = e.v as string[];
          if (m.length) await r.sadd(e.k, m as [string, ...string[]]);
        } else if (e.t === "list") {
          await r.del(e.k);
          const l = e.v as unknown[];
          if (l.length) await r.rpush(e.k, ...(l as never[]));
        } else await r.set(e.k, e.v as never);
      }
      return entries.length;
    },
  };
}

let store: Store | null = null;

/** Keys that never change anything a user can see (sessions, one-time tokens, passkey challenges, audit logs, ephemeral caches). */
const QUIET = ["session:", "user:sessions:", "verify:", "reset:", "totp:", "pkc:", "sys:", "audit:", "cache:"];
const loud = (k: string) => !QUIET.some((p) => k.startsWith(p));

const REV_TTL_MS = 1500;
const MAX_MEMO_KEYS = 250;
let memRev: number | null = null;
let memRevAt = 0;
let revInFlight: Promise<number> | null = null;
const memCache = new Map<string, { rev: number; val: unknown }>();
const memoInFlight = new Map<string, Promise<unknown>>();

function setKnownRev(rev: number) {
  if (memRev !== rev) memCache.clear();
  memRev = rev;
  memRevAt = Date.now();
}

/**
 * Wraps a store so every visible write bumps one counter (`sys:rev`) AFTER the write lands.
 * Clients poll that single number and refresh only when it moves, so the UI stays current without per-screen polling.
 * Ephemeral writes (TTL set, or QUIET prefixes) are ignored so logins and rate limits do not trigger refreshes.
 */
function withRev(s: Store): Store {
  const bump = async () => {
    try {
      const rev = Number(await s.incr("sys:rev"));
      setKnownRev(rev);
      void broadcastRev(rev);
    } catch {
      memRevAt = 0;
      memCache.clear();
    }
  };
  return {
    ...s,
    async set(k, v, o) {
      const ok = await s.set(k, v, o);
      if (ok && !o?.ex && loud(k)) await bump();
      return ok;
    },
    async del(...k) {
      await s.del(...k);
      if (k.some(loud)) await bump();
    },
    async sadd(k, ...m) {
      await s.sadd(k, ...m);
      if (loud(k)) await bump();
    },
    async srem(k, ...m) {
      await s.srem(k, ...m);
      if (loud(k)) await bump();
    },
    async lpush(k, v) {
      await s.lpush(k, v);
      if (loud(k)) await bump();
    },
  };
}

/** Current data revision; coalesced in-process for 1.5s and updated immediately on local writes. */
export async function currentRev(): Promise<number> {
  const now = Date.now();
  if (memRev !== null && now - memRevAt < REV_TTL_MS) return memRev;
  if (revInFlight) return revInFlight;
  revInFlight = db()
    .get<number | string>("sys:rev")
    .then((raw) => {
      const rev = Number(raw ?? 0);
      setKnownRev(rev);
      return rev;
    })
    .finally(() => {
      revInFlight = null;
    });
  return revInFlight;
}

/**
 * In-process revision-keyed memoization.
 * Returns a deep clone from RAM in 0ms while `sys:rev` is unchanged; automatically invalidates the instant `sys:rev` moves.
 */
export async function memoByRev<T>(key: string, load: (rev: number) => Promise<T>): Promise<T> {
  const rev = await currentRev();
  const hit = memCache.get(key);
  if (hit && hit.rev === rev) return structuredClone(hit.val) as T;
  const inflightKey = `${rev}:${key}`;
  const pending = memoInFlight.get(inflightKey);
  if (pending) return structuredClone(await pending) as T;
  const task = load(rev)
    .then((val) => {
      if (memCache.size >= MAX_MEMO_KEYS) {
        const oldest = memCache.keys().next().value;
        if (oldest !== undefined) memCache.delete(oldest);
      }
      if (memRev === rev) memCache.set(key, { rev, val: structuredClone(val) });
      return val;
    })
    .finally(() => {
      memoInFlight.delete(inflightKey);
    });
  memoInFlight.set(inflightKey, task);
  return structuredClone(await task);
}

/** Batch-primes the in-process revision cache from a single `mget` call. */
export function primeMemo(rev: number, entries: Record<string, unknown>) {
  setKnownRev(rev);
  for (const [k, v] of Object.entries(entries)) {
    memCache.set(k, { rev, val: structuredClone(v) });
  }
}

export function db(): Store {
  if (store) return store;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) store = withRev(upstashStore(new Redis({ url, token, keepAlive: true, enableTelemetry: false })));
  else if (process.env.NODE_ENV === "production") throw new Error("UPSTASH_REDIS_REST_URL/TOKEN are required in production");
  else store = withRev(memoryStore());
  return store;
}
