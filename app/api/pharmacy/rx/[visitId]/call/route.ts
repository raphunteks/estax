import { fail, isResponse, json, requirePerm } from "@/lib/api";
import { audit, rateLimit } from "@/lib/auth/guards";
import { callRx } from "@/lib/clinic/pharmacy";

export async function POST(_: Request, { params }: { params: Promise<{ visitId: string }> }) {
  const a = await requirePerm("pharmacy:dispense");
  if (isResponse(a)) return a;
  if (!(await rateLimit("rx-call", a.user.id, 300, 3600))) return fail("rate_limited", 429);
  const id = (await params).visitId;
  const rx = await callRx(id);
  if (!rx) return fail("state", 409, "Resep tidak menunggu.");
  await audit("pharmacy.called", a.user.id, { visit: id });
  return json({ ok: true });
}
