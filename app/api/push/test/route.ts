import { fail, isResponse, json, requireAuth } from "@/lib/api";
import { rateLimit } from "@/lib/auth/guards";
import { notifyUser } from "@/lib/push";

export async function POST() {
  const a = await requireAuth({ allowLocked: true });
  if (isResponse(a)) return a;
  if (!(await rateLimit("push-test", a.user.id, 10, 3600))) return fail("rate_limited", 429);
  const sent = await notifyUser(a.user.id, { title: "Notifikasi aktif", body: "Perangkat ini akan menerima pemberitahuan dari Estaka Dental Clinic.", url: "/" });
  return json({ ok: true, sent });
}
