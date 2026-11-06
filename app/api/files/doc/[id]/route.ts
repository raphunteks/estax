import { fail, isResponse, requireAuth } from "@/lib/api";
import { can } from "@/lib/auth/rbac";
import { ownsPatient } from "@/lib/clinic/family";
import { db } from "@/lib/db/store";
import { readObject } from "@/lib/storage";
import type { PFile } from "@/app/api/portal/berkas/route";

/** Patient uploads: the owner or clinical staff only. No public URL. */
export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await requireAuth();
  if (isResponse(a)) return a;
  const { id } = await ctx.params;
  if (!/^[A-Za-z0-9_-]{6,24}$/.test(id)) return fail("not_found", 404);
  const m = await db().get<PFile>(`pfm:${id}`);
  const ok = m && (a.user.role === "pasien" ? await ownsPatient(a.user.id, m.patientId) : can(a.user.role, "patients:read"));
  if (!m || !ok) return fail("not_found", 404);
  const o = await readObject(`pf/${id}`);
  if (!o) return fail("not_found", 404);
  return new Response(o.body, { headers: { "Content-Type": o.type, "Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff" } });
}
