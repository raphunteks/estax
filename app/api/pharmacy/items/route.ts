import { fail, isResponse, json, requirePerm } from "@/lib/api";
import { audit } from "@/lib/auth/guards";
import { can } from "@/lib/auth/rbac";
import { createItem, itemSchema, listItems, stock, usable } from "@/lib/clinic/pharmacy";
import { currentRev, db } from "@/lib/db/store";

export const canStock = (role: Parameters<typeof can>[0], kind: string) => role === "superadmin" || role === "apoteker" || (kind !== "obat" && can(role, "pharmacy:stock-supplies"));

export async function GET() {
  const a = await requirePerm("pharmacy:read");
  if (isResponse(a)) return a;

  const rev = await currentRev();
  const cacheKey = `cache:ph:items:${a.user.role}:${rev}`;
  try {
    const cached = await db().get<{ items: unknown[]; canCreate: boolean }>(cacheKey);
    if (cached) return json({ ok: true, ...cached, fromCache: true });
  } catch {
    /* fallback */
  }

  const items = await listItems();
  const payload = {
    items: items.map((i) => ({ ...i, stock: stock(i), usable: usable(i), editable: canStock(a.user.role, i.kind) })),
    canCreate: ["superadmin", "apoteker", "staf"].includes(a.user.role),
  };
  try {
    await db().set(cacheKey, payload, { ex: 3600 });
  } catch {
    /* ignore */
  }
  return json({ ok: true, ...payload });
}
export async function POST(req: Request) {
  const a = await requirePerm("pharmacy:read");
  if (isResponse(a)) return a;
  const p = itemSchema.safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("validation", 400, p.error.issues[0]?.message);
  if (!canStock(a.user.role, p.data.kind)) return fail("forbidden", 403);
  const it = await createItem(p.data, a.user.id);
  await audit("pharmacy.item-created", a.user.id, { item: it.id });
  return json({ ok: true, id: it.id });
}
