import { fail, isResponse, json, requireAuth } from "@/lib/api";
import { audit } from "@/lib/auth/guards";
import { can } from "@/lib/auth/rbac";
import { calendarDay } from "@/lib/clinic/appointments";
import { present } from "@/lib/clinic/present";
import { addDays } from "@/lib/clinic/time";

/** Seven days of slots for one doctor. A dokter can only open their own calendar. */
export async function GET(req: Request) {
  const a = await requireAuth();
  if (isResponse(a)) return a;
  const u = new URL(req.url).searchParams;
  const doctor = a.user.role === "dokter" ? a.user.id : (u.get("doctor") ?? "");
  const from = u.get("from") ?? "";
  if (!can(a.user.role, "appointments:read")) {
    await audit("access.denied", a.user.id, { perm: "appointments:read" });
    return fail("forbidden", 403);
  }
  if (!/^[\w-]{6,40}$/.test(doctor) || !/^\d{4}-\d{2}-\d{2}$/.test(from)) return fail("validation");
  const days = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(from, i);
    const slots = await calendarDay(doctor, date, a.user.id);
    const appts = await present(slots.flatMap((s) => (s.appt ? [s.appt] : [])));
    days.push({ date, slots: slots.map(({ appt, ...s }) => ({ ...s, appt: appt ? appts.find((x) => x.id === appt.id) : null })) });
  }
  return json({ ok: true, days });
}
