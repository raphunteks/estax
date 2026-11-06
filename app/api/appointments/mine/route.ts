import { fail, isResponse, json, requireAuth } from "@/lib/api";
import { listAppts } from "@/lib/clinic/appointments";
import { ownIds } from "@/lib/clinic/family";
import { present } from "@/lib/clinic/present";

export async function GET() {
  const a = await requireAuth();
  if (isResponse(a)) return a;
  if (a.user.role !== "pasien") return fail("forbidden", 403);
  const rows = (await Promise.all((await ownIds(a.user.id)).map((id) => listAppts({ patientId: id })))).flat().sort((x, y) => (y.date + y.time).localeCompare(x.date + x.time));
  return json({ ok: true, appointments: await present(rows) });
}
