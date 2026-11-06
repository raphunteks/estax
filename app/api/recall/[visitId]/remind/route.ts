import { fail, isResponse, json, requirePerm } from "@/lib/api";
import { audit, rateLimit } from "@/lib/auth/guards";
import { remindRecall } from "@/lib/clinic/care";

export async function POST(_: Request, ctx: { params: Promise<{ visitId: string }> }) {
  const a = await requirePerm("recall:manage");
  if (isResponse(a)) return a;
  if (!(await rateLimit("recall-remind", a.user.id, 120, 3600))) return fail("rate_limited", 429);
  const id = (await ctx.params).visitId;
  if (!(await remindRecall(id))) return fail("not_found", 404);
  await audit("recall.reminded", a.user.id, { visit: id });
  return json({ ok: true });
}
