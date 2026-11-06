import { fail, isResponse, json, requirePerm } from "@/lib/api";
import { audit, rateLimit } from "@/lib/auth/guards";
import { listUsers } from "@/lib/auth/users";
import { getPromo, isLive, savePromo } from "@/lib/clinic/promos";
import { notifyUser } from "@/lib/push";

/** Superadmin only: push + inbox message to every active patient account. */
export async function POST(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await requirePerm("promo:manage");
  if (isResponse(a)) return a;
  if (a.user.role !== "superadmin") return fail("forbidden", 403);
  if (!(await rateLimit("promo-announce", a.user.id, 10, 3600))) return fail("rate_limited", 429);
  const pr = await getPromo((await ctx.params).id);
  if (!pr) return fail("not_found", 404);
  if (!isLive(pr)) return fail("state", 409, "Hanya promo aktif yang sedang berlaku yang dapat diumumkan.");
  const users = (await listUsers()).filter((u) => u.role === "pasien" && u.active);
  let devices = 0;
  for (const u of users) devices += await notifyUser(u.id, { title: `Promo: ${pr.name}`, body: pr.desc || `Berlaku sampai ${pr.end}.`, url: "/portal/promo", tag: `promo-${pr.id}` });
  await savePromo({ ...pr, announcedAt: Date.now() });
  await audit("promo.announced", a.user.id, { promo: pr.id, patients: users.length });
  return json({ ok: true, patients: users.length, devices });
}
