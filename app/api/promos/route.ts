import { fail, isResponse, json, requirePerm } from "@/lib/api";
import { audit } from "@/lib/auth/guards";
import { claimsOf, createPromo, listPromos, promoSchema, viewsOf } from "@/lib/clinic/promos";

export async function GET() {
  const a = await requirePerm("promo:manage");
  if (isResponse(a)) return a;
  const list = await listPromos();
  return json({ ok: true, promos: await Promise.all(list.map(async (p) => ({ ...p, claims: await claimsOf(p.id), views: await viewsOf(p.id) }))), canActivate: a.user.role === "superadmin", me: a.user.id });
}
/** Doctors can only draft; a promo goes live when the superadmin activates it. */
export async function POST(req: Request) {
  const a = await requirePerm("promo:manage");
  if (isResponse(a)) return a;
  const p = promoSchema.safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("validation", 400, p.error.issues[0]?.message);
  const d = a.user.role === "superadmin" ? p.data : { ...p.data, status: "draf" as const };
  const pr = await createPromo(d, a.user.id);
  await audit("promo.created", a.user.id, { promo: pr.id });
  return json({ ok: true, promo: pr }, 201);
}
