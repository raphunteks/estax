import { fail, isResponse, json, requireAuth } from "@/lib/api";
import { analytics, sectionsFor } from "@/lib/clinic/analytics";
import { currentRev, db } from "@/lib/db/store";
import { todayWita } from "@/lib/clinic/time";

export async function GET(req: Request) {
  const a = await requireAuth();
  if (isResponse(a)) return a;
  if (!sectionsFor(a.user.role).length) return fail("forbidden", 403);
  const d = Number(new URL(req.url).searchParams.get("days") ?? 30);
  if (![7, 30, 90].includes(d)) return fail("validation");

  const rev = await currentRev();
  const today = todayWita();
  const targetId = a.user.role === "dokter" ? a.user.id : "all";
  const cacheKey = `cache:analytics:${a.user.role}:${targetId}:${d}:${rev}:${today}`;

  try {
    const cached = await db().get<Record<string, unknown>>(cacheKey);
    if (cached) {
      return json({ ok: true, ...cached, fromCache: true }, 200);
    }
  } catch {
    /* fallback to compute */
  }

  const data = await analytics({ id: a.user.id, role: a.user.role }, d);

  try {
    // Cache for 1 hour. Natural invalidation occurs because cacheKey includes :${rev}:!
    await db().set(cacheKey, data, { ex: 3600 });
  } catch {
    /* ignore cache write fail */
  }

  return json({ ok: true, ...data }, 200);
}
