import { isResponse, json, requirePerm } from "@/lib/api";
import { listSurveys } from "@/lib/clinic/engage";
import { getUser } from "@/lib/auth/users";

export async function GET() {
  const a = await requirePerm("survey:read");
  if (isResponse(a)) return a;
  const all = (await listSurveys()).filter((s) => a.user.role !== "dokter" || s.doctorId === a.user.id);
  const names = new Map<string, string>();
  for (const s of all) if (!names.has(s.doctorId)) names.set(s.doctorId, (await getUser(s.doctorId))?.name ?? "-");
  const avg = all.length ? Math.round((all.reduce((n, s) => n + s.rating, 0) / all.length) * 10) / 10 : 0;
  const dist = [1, 2, 3, 4, 5].map((r) => all.filter((s) => s.rating === r).length);
  return json({ ok: true, count: all.length, avg, dist, rows: all.slice(0, 100).map((s) => ({ id: s.id, rating: s.rating, comment: s.comment, t: s.t, doctor: names.get(s.doctorId) })) });
}
