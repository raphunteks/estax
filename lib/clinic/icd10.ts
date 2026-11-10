import "server-only";
import { db } from "@/lib/db/store";
import { ICD_SEED } from "./icd10-seed";

/** [code, English title (WHO), Indonesian label?] */
export type Icd = [string, string, string?];
type Meta = { count: number; chunks: number; source: string; at: number };
const CHUNK = 1500;
const META = "icd10:meta";
const chunkKey = (i: number) => `icd10:c:${i}`;

let mem: { rows: Icd[]; at: number } | null = null;

const parseSeed = (): Icd[] => ICD_SEED.split("\n").map((l) => l.split("|") as Icd);

async function store(rows: Icd[], source: string) {
  const old = await db().get<Meta>(META);
  const chunks = Math.ceil(rows.length / CHUNK);
  for (let i = 0; i < chunks; i++) await db().set(chunkKey(i), rows.slice(i * CHUNK, (i + 1) * CHUNK));
  await db().set(META, { count: rows.length, chunks, source, at: Date.now() } satisfies Meta);
  for (let i = chunks; i < (old?.chunks ?? 0); i++) await db().del(chunkKey(i));
  mem = { rows, at: Date.now() };
}

/** Loads the code list from the database (seeding the dental set on first use); cached in memory for 10 minutes. */
async function all(): Promise<Icd[]> {
  if (mem && Date.now() - mem.at < 600_000) return mem.rows;
  const meta = await db().get<Meta>(META);
  if (!meta) {
    await store(parseSeed(), "seed-gigi");
    return mem!.rows;
  }
  const chunkKeys = Array.from({ length: meta.chunks }, (_, i) => chunkKey(i));
  const chunks = await db().mget<Icd[]>(...chunkKeys);
  const rows: Icd[] = [];
  for (const c of chunks) if (c) rows.push(...c);
  mem = { rows, at: Date.now() };
  return rows;
}

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9. ]/g, " ");

export async function searchIcd(q: string, limit = 25): Promise<Icd[]> {
  const rows = await all();
  const t = norm(q).trim();
  if (!t) return rows.filter((r) => /^K0[0-5]/.test(r[0])).slice(0, limit);
  const words = t.split(/\s+/);
  const scored: [number, Icd][] = [];
  for (const r of rows) {
    const code = r[0].toLowerCase();
    const hay = norm(`${r[1]} ${r[2] ?? ""}`);
    let s = 0;
    if (code === t) s = 100;
    else if (code.startsWith(t)) s = 80;
    else if (words.every((w) => code.includes(w) || hay.includes(w))) s = hay.startsWith(t) ? 60 : 40;
    if (s) scored.push([s, r]);
  }
  return scored.sort((a, b) => b[0] - a[0] || a[1][0].localeCompare(b[1][0])).slice(0, limit).map((x) => x[1]);
}

export async function icdTitle(code: string) {
  return (await all()).find((r) => r[0] === code);
}
export async function icdMeta() {
  await all();
  return db().get<Meta>(META);
}

/**
 * Imports the WHO ICD-10 plain-text table (icd102019enMeta.zip -> icd102019syst_codes.txt). Tolerant parser: each line has a code
 * column (A00.0 or A000) and the title is the last column. Three-character categories are kept only when they have no sub-codes.
 */
export async function importIcd(text: string) {
  const rows = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const cols = line.split(/;|\t/).map((c) => c.trim());
    if (cols.length < 2) continue;
    const title = cols[cols.length - 1];
    // Rows carry the 3-character category, the dotted code and the undotted code: prefer the most specific one.
    const raw = cols.find((c) => /^[A-Z]\d{2}\.\d{1,2}$/.test(c)) ?? cols.find((c) => /^[A-Z]\d{3,4}$/.test(c)) ?? cols.find((c) => /^[A-Z]\d{2}$/.test(c));
    if (!raw || !title || title === raw) continue;
    const code = raw.includes(".") || raw.length === 3 ? raw : `${raw.slice(0, 3)}.${raw.slice(3)}`;
    if (!rows.has(code)) rows.set(code, title.slice(0, 200));
  }
  const codes = [...rows.keys()];
  const parents = new Set(codes.filter((c) => c.includes(".")).map((c) => c.slice(0, 3)));
  const id = new Map(parseSeed().map((r) => [r[0], r[2]]));
  const out: Icd[] = codes.filter((c) => c.includes(".") || !parents.has(c)).sort().map((c) => [c, rows.get(c)!, id.get(c)]);
  if (out.length < 500) return { ok: false as const, count: out.length };
  await store(out, "who-2019");
  return { ok: true as const, count: out.length };
}
