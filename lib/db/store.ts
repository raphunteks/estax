import { Redis } from "@upstash/redis";
import fs from "node:fs";

/**
 * Minimal key-value surface used by the whole app (Upstash Redis in production).
 * Without Upstash env vars, a file-backed in-memory store is used for LOCAL DEV ONLY; production refuses to start without Redis.
 */
export interface Store {
  get<T = unknown>(k: string): Promise<T | null>;
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
export function db(): Store {
  if (store) return store;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) store = upstashStore(new Redis({ url, token }));
  else if (process.env.NODE_ENV === "production") throw new Error("UPSTASH_REDIS_REST_URL/TOKEN are required in production");
  else store = memoryStore();
  return store;
}
export const isDevStore = () => !(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
