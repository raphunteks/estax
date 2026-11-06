import { fail, isResponse, json, requirePerm } from "@/lib/api";
import { getSite } from "@/lib/site";
import { hermesConfigured } from "@/lib/notify/hermes";
import { clinic } from "@/lib/content";

/** Reminder template for staff who send WhatsApp reminders by hand. */
export async function GET() {
  const a = await requirePerm("appointments:read");
  if (isResponse(a)) return a;
  if (a.user.role === "apoteker") return fail("forbidden", 403);
  const s = await getSite();
  return json({ ok: true, enabled: s.wa.enabled, template: s.wa.template, hoursBefore: s.wa.hoursBefore, clinic: clinic.name, hermes: hermesConfigured() });
}
