import { fail, isResponse, json, requirePerm } from "@/lib/api";
import { audit } from "@/lib/auth/guards";
import { getPatient, summary } from "@/lib/clinic/patients";
import { listAppts } from "@/lib/clinic/appointments";
import { present } from "@/lib/clinic/present";

/** Profile without the encrypted ID number. Reading a patient record is audited. */
export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await requirePerm("patients:read");
  if (isResponse(a)) return a;
  const p = await getPatient((await ctx.params).id);
  if (!p) return fail("not_found", 404);
  await audit("patient.viewed", a.user.id, { patient: p.id });
  const { idEnc: _e, ...safe } = p;
  void _e;
  return json({ ok: true, patient: { ...safe, ...summary(p) }, appointments: await present((await listAppts({ patientId: p.id })).reverse()) });
}
