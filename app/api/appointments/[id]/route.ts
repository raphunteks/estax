import { z } from "zod";
import { fail, isResponse, json, requireAuth } from "@/lib/api";
import { audit, rateLimit } from "@/lib/auth/guards";
import { act, getAppt, isErr } from "@/lib/clinic/appointments";
import { ownsPatient } from "@/lib/clinic/family";
import { present } from "@/lib/clinic/present";

const body = z.object({
  action: z.enum(["confirm", "reject", "cancel", "reschedule", "checkin", "arrive", "call", "recall", "seat", "done", "noshow"]),
  note: z.string().max(200).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  doctorId: z.string().max(40).optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await requireAuth();
  if (isResponse(a)) return a;
  const p = body.safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("validation");
  const appt = await getAppt((await ctx.params).id);
  // Same answer for "missing" and "not yours", so ids cannot be probed.
  const owner = appt && a.user.role === "pasien" ? await ownsPatient(a.user.id, appt.patientId) : true;
  if (!appt || !owner || a.user.role === "apoteker") {
    if (appt) await audit("access.denied", a.user.id, { perm: "appointments:update", appt: appt.id });
    return fail("forbidden", 403);
  }
  if (!(await rateLimit("appt-act", a.user.id, 120, 3600))) return fail("rate_limited", 429);
  const r = await act(appt, p.data.action, { id: a.user.id, role: a.user.role }, p.data);
  if (isErr(r)) return fail(r.error, r.status, r.message);
  await audit(`appt.${p.data.action}`, a.user.id, { appt: r.id });
  return json({ ok: true, appointment: (await present([r]))[0] });
}
