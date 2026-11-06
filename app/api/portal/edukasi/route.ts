import { fail, isResponse, json, requireAuth } from "@/lib/api";
import { eduOfPatient } from "@/lib/clinic/care";
import { ownIds } from "@/lib/clinic/family";

export async function GET() {
  const a = await requireAuth();
  if (isResponse(a)) return a;
  if (a.user.role !== "pasien") return fail("forbidden", 403);
  const items = (await Promise.all((await ownIds(a.user.id)).map(eduOfPatient))).flat().sort((x, y) => y.t - x.t);
  return json({ ok: true, items });
}
