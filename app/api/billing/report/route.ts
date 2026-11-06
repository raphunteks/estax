import { fail, isResponse, json, requirePerm } from "@/lib/api";
import { report } from "@/lib/clinic/billing";
import { todayWita, addDays } from "@/lib/clinic/time";

export async function GET(req: Request) {
  const a = await requirePerm("billing:write");
  if (isResponse(a)) return a;
  const u = new URL(req.url).searchParams;
  const to = u.get("to") ?? todayWita(), from = u.get("from") ?? addDays(to, -29);
  if (![from, to].every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)) || from > to) return fail("validation");
  return json({ ok: true, from, to, ...(await report(from, to)) });
}
