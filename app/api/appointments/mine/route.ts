import { fail, isResponse, json, requireAuth } from "@/lib/api";
import { listAppts } from "@/lib/clinic/appointments";
import { patientOfUser } from "@/lib/clinic/patients";
import { present } from "@/lib/clinic/present";

export async function GET() {
  const a = await requireAuth();
  if (isResponse(a)) return a;
  if (a.user.role !== "pasien") return fail("forbidden", 403);
  const p = await patientOfUser(a.user.id);
  return json({ ok: true, appointments: p ? await present((await listAppts({ patientId: p.id })).reverse()) : [] });
}
