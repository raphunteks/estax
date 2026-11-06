import { fail, isResponse, json, requirePerm } from "@/lib/api";
import { audit } from "@/lib/auth/guards";
import { getPatient, issueRm, summary } from "@/lib/clinic/patients";

/** Staff matched the ID card: issue the sequential medical record number. */
export async function POST(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await requirePerm("patients:verify");
  if (isResponse(a)) return a;
  const p = await getPatient((await ctx.params).id);
  if (!p) return fail("not_found", 404);
  await issueRm(p);
  await audit("patient.verified", a.user.id, { patient: p.id, rm: p.rmNo });
  return json({ ok: true, patient: summary(p) });
}
