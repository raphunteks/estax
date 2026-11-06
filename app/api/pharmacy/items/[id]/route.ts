import { fail, isResponse, json, requirePerm } from "@/lib/api";
import { audit } from "@/lib/auth/guards";
import { getItem, patchItem, patchSchema } from "@/lib/clinic/pharmacy";
import { canStock } from "../route";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await requirePerm("pharmacy:read");
  if (isResponse(a)) return a;
  const id = (await params).id;
  const it = await getItem(id);
  if (!it) return fail("not_found", 404);
  if (!canStock(a.user.role, it.kind)) return fail("forbidden", 403);
  const p = patchSchema.safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("validation", 400, p.error.issues[0]?.message);
  const r = await patchItem(id, p.data, a.user.id);
  if (!r.ok) return fail(r.code, r.status, r.message);
  await audit(p.data.restock ? "pharmacy.restock" : p.data.count ? "pharmacy.count" : "pharmacy.item-edited", a.user.id, { item: id });
  return json({ ok: true });
}
