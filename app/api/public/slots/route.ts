import { fail, json } from "@/lib/api";
import { rateLimit } from "@/lib/auth/guards";
import { doctorsWithSchedule, slotsFor } from "@/lib/clinic/appointments";
import { clientIp } from "@/lib/redis";

/** Free times for one date. `doctor=any` merges all doctors. Only times and free/taken, never who booked. */
export async function GET(req: Request) {
  if (!(await rateLimit("pub-slots", clientIp(req), 120, 600))) return fail("rate_limited", 429);
  const u = new URL(req.url).searchParams;
  const doctor = u.get("doctor") ?? "", date = u.get("date") ?? "";
  if (!/^[\w-]{3,40}$/.test(doctor) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail("validation");
  const ids = doctor === "any" ? (await doctorsWithSchedule()).map((d) => d.id) : [doctor];
  const merged = new Map<string, boolean>();
  for (const id of ids) for (const s of await slotsFor(id, date, "public")) merged.set(s.start, (merged.get(s.start) ?? false) || s.state === "free");
  const slots = [...merged].sort(([a], [b]) => a.localeCompare(b)).map(([start, free]) => ({ start, free }));
  return json({ ok: true, slots });
}
