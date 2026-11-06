import { fail, isResponse, json, requireAuth } from "@/lib/api";
import { analytics, sectionsFor } from "@/lib/clinic/analytics";

export async function GET(req: Request) {
  const a = await requireAuth();
  if (isResponse(a)) return a;
  if (!sectionsFor(a.user.role).length) return fail("forbidden", 403);
  const d = Number(new URL(req.url).searchParams.get("days") ?? 30);
  if (![7, 30, 90].includes(d)) return fail("validation");
  return json({ ok: true, ...(await analytics({ id: a.user.id, role: a.user.role }, d)) }, 200);
}
