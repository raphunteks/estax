import { z } from "zod";
import { fail, isResponse, json, requireAuth } from "@/lib/api";
import { rateLimit } from "@/lib/auth/guards";
import { joinWaitlist, leaveWaitlist, onWaitlist } from "@/lib/clinic/engage";
import { doctorsWithSchedule } from "@/lib/clinic/appointments";

const q = z.object({ doctorId: z.string().min(6).max(40), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });
const guard = async () => {
  const a = await requireAuth();
  if (isResponse(a)) return a;
  return a.user.role === "pasien" ? a : fail("forbidden", 403);
};
export async function GET(req: Request) {
  const a = await guard();
  if (isResponse(a)) return a;
  const u = new URL(req.url).searchParams;
  const p = q.safeParse({ doctorId: u.get("doctorId"), date: u.get("date") });
  if (!p.success) return fail("validation");
  return json({ ok: true, on: await onWaitlist(p.data.doctorId, p.data.date, a.user.id) });
}
export async function POST(req: Request) {
  const a = await guard();
  if (isResponse(a)) return a;
  const p = q.safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("validation");
  if (!(await rateLimit("waitlist", a.user.id, 20, 3600))) return fail("rate_limited", 429);
  if (!(await doctorsWithSchedule()).some((d: { id: string }) => d.id === p.data.doctorId)) return fail("not_found", 404);
  await joinWaitlist(p.data.doctorId, p.data.date, a.user.id);
  return json({ ok: true }, 201);
}
export async function DELETE(req: Request) {
  const a = await guard();
  if (isResponse(a)) return a;
  const u = new URL(req.url).searchParams;
  const p = q.safeParse({ doctorId: u.get("doctorId"), date: u.get("date") });
  if (!p.success) return fail("validation");
  await leaveWaitlist(p.data.doctorId, p.data.date, a.user.id);
  return json({ ok: true });
}
