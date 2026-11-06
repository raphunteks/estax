import { z } from "zod";
import { fail, isResponse, json, requireAuth } from "@/lib/api";
import { audit, rateLimit } from "@/lib/auth/guards";
import { notify } from "@/lib/clinic/appointments";
import { getPatient } from "@/lib/clinic/patients";
import { getVisit } from "@/lib/clinic/visits";
import { notifyRole, notifyUser } from "@/lib/push";

const body = z.object({ target: z.enum(["patient", "farmasi"]), visitId: z.string().min(6).max(60), message: z.string().trim().min(2).max(200) });

/** Doctor/staff -> patient (portal push, email fallback), doctor -> pharmacists. The message text is plain text only. */
export async function POST(req: Request) {
  const a = await requireAuth();
  if (isResponse(a)) return a;
  const p = body.safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("validation");
  const allowed = p.data.target === "patient" ? ["dokter", "staf", "superadmin"] : ["dokter", "superadmin"];
  if (!allowed.includes(a.user.role)) return fail("forbidden", 403);
  if (!(await rateLimit("push-send", a.user.id, 60, 3600))) return fail("rate_limited", 429);
  const v = await getVisit(p.data.visitId);
  if (!v || (a.user.role === "dokter" && v.doctorId !== a.user.id)) return fail("not_found", 404);
  const pat = await getPatient(v.patientId);
  let sent = 0;
  if (p.data.target === "patient") {
    if (pat?.userId) sent = await notifyUser(pat.userId, { title: `Pesan dari ${a.user.name}`, body: p.data.message, url: "/portal" });
    else await notify(v.patientId, `Pesan dari ${a.user.name}`, p.data.message);
  } else {
    sent = await notifyRole("apoteker", { title: `Pesan dokter: ${pat?.name ?? "pasien"}`, body: p.data.message, url: "/dashboard/farmasi" });
  }
  await audit("push.sent", a.user.id, { target: p.data.target, visit: v.id });
  return json({ ok: true, sent });
}
