import { fail, json } from "@/lib/api";
import { rateLimit } from "@/lib/auth/guards";
import { doctorsWithSchedule, slotsFor, slotsForMany } from "@/lib/clinic/appointments";
import { getMaster, getSchedule } from "@/lib/master";
import { clientIp } from "@/lib/redis";

/** Free times for one date. `doctor=any` merges all doctors. Only times and free/taken, never who booked. */
export async function GET(req: Request) {
  const u = new URL(req.url).searchParams;
  const doctor = u.get("doctor") ?? "", date = u.get("date") ?? "";
  if (!/^[\w-]{3,40}$/.test(doctor) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail("validation");
  if (doctor === "any") {
    const [allowed, allSlots] = await Promise.all([
      rateLimit("pub-slots", clientIp(req), 120, 600),
      Promise.all([doctorsWithSchedule(), getMaster("rules")]).then(([docs, rules]) => slotsForMany(docs, date, "public", rules)),
    ]);
    if (!allowed) return fail("rate_limited", 429);
    const merged = new Map<string, boolean>();
    for (const list of allSlots) for (const s of list) merged.set(s.start, (merged.get(s.start) ?? false) || s.state === "free");
    const slots = [...merged].sort(([a], [b]) => a.localeCompare(b)).map(([start, free]) => ({ start, free }));
    return json({ ok: true, slots });
  }
  const [allowed, raw] = await Promise.all([
    rateLimit("pub-slots", clientIp(req), 120, 600),
    Promise.all([getSchedule(doctor), getMaster("rules")]).then(([sch, rules]) => slotsFor(doctor, date, "public", { sch, rules })),
  ]);
  if (!allowed) return fail("rate_limited", 429);
  return json({ ok: true, slots: raw.map((s) => ({ start: s.start, free: s.state === "free" })) });
}
