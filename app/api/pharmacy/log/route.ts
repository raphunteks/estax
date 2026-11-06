import { isResponse, json, requirePerm } from "@/lib/api";
import { moves } from "@/lib/clinic/pharmacy";
import { getUser } from "@/lib/auth/users";

export async function GET() {
  const a = await requirePerm("pharmacy:read");
  if (isResponse(a)) return a;
  const m = await moves(); const names = new Map<string, string>();
  for (const x of m) if (!names.has(x.by)) names.set(x.by, (await getUser(x.by))?.name ?? "-");
  return json({ ok: true, moves: m.slice(0, 100).map((x) => ({ ...x, byName: names.get(x.by) })) });
}
