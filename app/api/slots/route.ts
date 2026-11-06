import { fail, isResponse, json, requireAuth } from "@/lib/api";
import { slotsFor } from "@/lib/clinic/appointments";

export async function GET(req: Request) {
  const a = await requireAuth();
  if (isResponse(a)) return a;
  const u = new URL(req.url);
  const doctor = u.searchParams.get("doctor") ?? "";
  const date = u.searchParams.get("date") ?? "";
  if (!/^[\w-]{6,40}$/.test(doctor) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail("validation");
  return json({ ok: true, slots: (await slotsFor(doctor, date, a.user.id)).map(({ apptId: _i, ...s }) => (void _i, s)) });
}
