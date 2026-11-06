import { z } from "zod";
import { fail, isResponse, json, requirePerm } from "@/lib/api";
import { audit, rateLimit } from "@/lib/auth/guards";
import { getAppt } from "@/lib/clinic/appointments";
import { sendWaFor } from "@/lib/clinic/reminders";

/** Staff press "Kirim" on one appointment: delivered through the Hermes webhook. */
export async function POST(req: Request) {
  const a = await requirePerm("appointments:create");
  if (isResponse(a)) return a;
  if (a.user.role === "dokter" || a.user.role === "apoteker") return fail("forbidden", 403);
  const p = z.object({ apptId: z.string().max(40) }).safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("validation");
  if (!(await rateLimit("wa-send", a.user.id, 60, 3600))) return fail("rate_limited", 429);
  const appt = await getAppt(p.data.apptId);
  if (!appt || appt.status !== "dikonfirmasi") return fail("not_ready", 409, "Janji belum dikonfirmasi.");
  const r = await sendWaFor(appt, { force: true });
  await audit("wa.reminder", a.user.id, { appt: appt.id, ok: r.ok });
  if (!r.ok) return fail(r.reason ?? "failed", 502, r.reason === "no_phone" ? "Nomor HP pasien tidak valid." : r.reason === "not_configured" ? "Hermes belum dikonfigurasi." : "Gagal mengirim via Hermes.");
  return json({ ok: true });
}
