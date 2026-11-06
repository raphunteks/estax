import { z } from "zod";
import { fail, isResponse, json, requirePerm } from "@/lib/api";
import { audit, rateLimit } from "@/lib/auth/guards";
import { decrypt } from "@/lib/auth/crypto";
import { db, type DumpEntry } from "@/lib/db/store";

export const runtime = "nodejs";
export const maxDuration = 60;

const body = z.object({ file: z.string().min(20).max(30_000_000), mode: z.enum(["check", "apply"]), confirm: z.string().optional() });
const entry = z.object({ k: z.string().min(1).max(300), t: z.enum(["value", "set", "list"]), v: z.unknown() });
const SKIP = /^(session:|rl:|lock:)/;

/** Restore from an encrypted backup. `check` only reports; `apply` needs the typed confirmation and overwrites keys present in the file. */
export async function POST(req: Request) {
  const a = await requirePerm("backup:manage");
  if (isResponse(a)) return a;
  if (!(await rateLimit("restore", a.user.id, 10, 3600))) return fail("rate_limited", 429, "Terlalu sering. Coba lagi nanti.");
  const p = body.safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("validation", 400, "Berkas tidak valid.");
  let entries: DumpEntry[];
  let at = "";
  try {
    const j = JSON.parse(decrypt(p.data.file.trim())) as { v?: number; at?: string; entries?: unknown[] };
    if (j.v !== 1 || !Array.isArray(j.entries)) throw new Error("format");
    const parsed = z.array(entry).parse(j.entries);
    entries = parsed.filter((e) => !SKIP.test(e.k)) as DumpEntry[];
    at = j.at ?? "";
  } catch {
    return fail("bad_backup", 400, "Berkas cadangan tidak bisa dibuka (kunci enkripsi berbeda atau berkas rusak).");
  }
  const groups: Record<string, number> = {};
  for (const e of entries) groups[e.k.split(":")[0]] = (groups[e.k.split(":")[0]] ?? 0) + 1;
  if (p.data.mode === "check") return json({ ok: true, at, keys: entries.length, groups });
  if (p.data.confirm !== "PULIHKAN") return fail("confirm_required", 400, 'Ketik "PULIHKAN" untuk melanjutkan.');
  const n = await db().restore(entries);
  await audit("backup.restore", a.user.id, { keys: n, at });
  return json({ ok: true, restored: n });
}
