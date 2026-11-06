import { fail, isResponse, json, requireAuth } from "@/lib/api";
import { ownIds } from "@/lib/clinic/family";
import { getRx } from "@/lib/clinic/pharmacy";
import { visitsOfPatient } from "@/lib/clinic/visits";

/** "3x1", "2 x 1", "1x sehari", "tiap 8 jam" -> reminder times (WITA, 24 h). Unknown text -> no times. */
export function timesFor(freq: string): string[] {
  const f = freq.toLowerCase();
  const n = /(\d)\s*(?:x|kali)/.exec(f)?.[1] ?? (/jam/.test(f) ? String(Math.round(24 / Math.max(1, Number(/(\d+)\s*jam/.exec(f)?.[1] ?? 8)))) : "");
  return ({ "1": ["08:00"], "2": ["08:00", "20:00"], "3": ["07:00", "13:00", "20:00"], "4": ["07:00", "12:00", "17:00", "22:00"] } as Record<string, string[]>)[n] ?? [];
}
export async function GET() {
  const a = await requireAuth();
  if (isResponse(a)) return a;
  if (a.user.role !== "pasien") return fail("forbidden", 403);
  const out = [];
  const today = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
  for (const pid of await ownIds(a.user.id)) {
    for (const v of (await visitsOfPatient(pid)).filter((x) => x.status === "selesai").slice(0, 6)) {
      const rx = await getRx(v.id);
      if (!rx) continue;
      const lines = rx.lines.map((l) => {
        const total = Math.max(0, parseInt(l.days, 10) || 0);
        const day = Math.floor((Date.parse(today) - Date.parse(rx.date)) / 86400000) + 1;
        return { ...l, times: timesFor(l.freq), total, day, active: total > 0 && day >= 1 && day <= total };
      });
      out.push({ visitId: v.id, date: rx.date, status: rx.status, lines });
    }
  }
  return json({ ok: true, items: out.sort((x, y) => y.date.localeCompare(x.date)) });
}
