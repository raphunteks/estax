import { fail, isResponse, requirePerm } from "@/lib/api";
import { audit, rateLimit } from "@/lib/auth/guards";
import { encrypt } from "@/lib/auth/crypto";
import { db } from "@/lib/db/store";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Encrypted full backup (AES-256-GCM with ENCRYPTION_KEY). Superadmin only; sessions and one-time tokens are not included. */
export async function GET() {
  const a = await requirePerm("backup:manage");
  if (isResponse(a)) return a;
  if (!(await rateLimit("backup", a.user.id, 5, 3600))) return fail("rate_limited", 429, "Terlalu sering. Coba lagi nanti.");
  const entries = await db().dump();
  const body = encrypt(JSON.stringify({ v: 1, at: new Date().toISOString(), entries }));
  await audit("backup.download", a.user.id, { keys: entries.length });
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Content-Disposition": `attachment; filename="estaka-backup-${stamp}.enc"`, "Cache-Control": "no-store" } });
}
