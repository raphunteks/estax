import { z } from "zod";
import { fail, isResponse, json, requireAuth } from "@/lib/api";
import { rateLimit } from "@/lib/auth/guards";
import { holdSlot, validateSlot } from "@/lib/clinic/appointments";

const body = z.object({ doctorId: z.string().min(6).max(40), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), time: z.string().regex(/^\d{2}:\d{2}$/) });

/** Holds a slot for 5 minutes while the patient fills the form. */
export async function POST(req: Request) {
  const a = await requireAuth();
  if (isResponse(a)) return a;
  const p = body.safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("validation");
  if (!(await rateLimit("hold", a.user.id, 30, 600))) return fail("rate_limited", 429);
  const bad = await validateSlot(p.data.doctorId, p.data.date, p.data.time, a.user.id);
  if (bad) return fail(bad.error, bad.status, bad.message);
  if (!(await holdSlot(p.data.doctorId, p.data.date, p.data.time, a.user.id))) return fail("slot_held", 409, "Slot sedang dipilih pasien lain.");
  return json({ ok: true, holdSeconds: 300 });
}
