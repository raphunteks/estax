import { fail, isResponse, json, requirePerm } from "@/lib/api";
import { audit } from "@/lib/auth/guards";
import { claimsOf, deletePromo, getPromo, promoSchema, savePromo } from "@/lib/clinic/promos";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await requirePerm("promo:manage");
  if (isResponse(a)) return a;
  const pr = await getPromo((await ctx.params).id);
  if (!pr) return fail("not_found", 404);
  const sa = a.user.role === "superadmin";
  if (!sa && (pr.createdBy !== a.user.id || pr.status !== "draf")) return fail("forbidden", 403, "Dokter hanya dapat mengubah draf miliknya.");
  const p = promoSchema.safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("validation", 400, p.error.issues[0]?.message);
  await savePromo({ ...pr, ...p.data, status: sa ? p.data.status : "draf" });
  await audit("promo.updated", a.user.id, { promo: pr.id, status: p.data.status });
  return json({ ok: true });
}
export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await requirePerm("promo:manage");
  if (isResponse(a)) return a;
  const pr = await getPromo((await ctx.params).id);
  if (!pr) return fail("not_found", 404);
  const sa = a.user.role === "superadmin";
  if (!sa && pr.createdBy !== a.user.id) return fail("forbidden", 403);
  if ((await claimsOf(pr.id)) > 0) return fail("used", 409, "Promo sudah dipakai. Jeda saja, jangan dihapus.");
  await deletePromo(pr.id);
  await audit("promo.deleted", a.user.id, { promo: pr.id });
  return json({ ok: true });
}
