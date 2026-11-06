import { z } from "zod";
import { fail, isResponse, json, requireAuth } from "@/lib/api";
import { rateLimit } from "@/lib/auth/guards";
import { ACTIVE, getAppt } from "@/lib/clinic/appointments";
import { ownsPatient } from "@/lib/clinic/family";
import { db } from "@/lib/db/store";

const t = (n: number) => z.string().trim().max(n);
const body = z.object({ complaint: t(500).min(3), allergies: t(300).optional(), medications: t(300).optional(), conditions: t(300).optional() });
/** The patient fills the anamnesis before the visit; the doctor sees it prefilled in the exam. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await requireAuth();
  if (isResponse(a)) return a;
  if (a.user.role !== "pasien") return fail("forbidden", 403);
  const p = body.safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("validation", 400, "Tuliskan keluhan utama.");
  if (!(await rateLimit("previsit", a.user.id, 30, 3600))) return fail("rate_limited", 429);
  const ap = await getAppt((await ctx.params).id);
  if (!ap || !(await ownsPatient(a.user.id, ap.patientId))) return fail("not_found", 404);
  if (!ACTIVE.includes(ap.status)) return fail("state", 409, "Janji ini sudah tidak aktif.");
  ap.pre = { ...p.data, complaint: p.data.complaint, at: Date.now() };
  await db().set(`appt:${ap.id}`, ap);
  return json({ ok: true });
}
