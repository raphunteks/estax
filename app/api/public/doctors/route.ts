import { fail, json } from "@/lib/api";
import { rateLimit } from "@/lib/auth/guards";
import { doctorsWithSchedule } from "@/lib/clinic/appointments";
import { getMaster } from "@/lib/master";
import { todayWita } from "@/lib/clinic/time";
import { clientIp } from "@/lib/redis";

/** Public list for the booking form: name, practice weekdays and leave dates of doctors that have a practice schedule (no contact data). */
export async function GET(req: Request) {
  const [allowed, rules, docs] = await Promise.all([
    rateLimit("pub-doc", clientIp(req), 60, 600),
    getMaster("rules"),
    doctorsWithSchedule(),
  ]);
  if (!allowed) return fail("rate_limited", 429);
  const today = todayWita();
  return json({ ok: true, horizon: rules.horizonDays, doctors: docs.map((d) => ({
    id: d.id, name: d.name,
    // Weekdays with practice hours and upcoming leave dates, so the form can grey out days that have no slots.
    days: Object.entries(d.schedule!.days).filter(([, l]) => l && l.length).map(([k]) => Number(k)),
    off: (d.schedule!.leave ?? []).filter((x) => x >= today),
  })) });
}
