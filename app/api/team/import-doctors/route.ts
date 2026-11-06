import { z } from "zod";
import { fail, isResponse, json, requirePerm } from "@/lib/api";
import { audit } from "@/lib/auth/guards";
import { randomToken } from "@/lib/auth/crypto";
import { createUser, findByEmail, listUsers } from "@/lib/auth/users";
import { doctors } from "@/lib/content";
import { getSchedule, setSchedule } from "@/lib/master";

const body = z.object({ emails: z.record(z.string(), z.union([z.literal(""), z.string().trim().email().max(120)])).default({}) });
const norm = (s: string) => s.toLowerCase().replace(/^drg\.?\s*/, "").replace(/[^a-z]/g, "");

/**
 * Creates a doctor account + default schedule (Mon-Sat 09:00-17:00) for every doctor shown on the site that has no account yet.
 * Emails come from the request; without one a non-deliverable placeholder (.invalid) is used and must be replaced later.
 * Superadmin only. Existing accounts are never changed; a missing schedule is filled in.
 */
export async function POST(req: Request) {
  const a = await requirePerm("settings:write");
  if (isResponse(a)) return a;
  if (a.user.role !== "superadmin") return fail("forbidden", 403);
  const p = body.safeParse(await req.json().catch(() => ({})));
  if (!p.success) return fail("validation", 400, "Email tidak valid.");
  const users = await listUsers();
  const out: { name: string; status: "dibuat" | "sudah_ada"; schedule: boolean; placeholderEmail: boolean }[] = [];
  for (const d of doctors) {
    let u = users.find((x) => x.role === "dokter" && norm(x.name) === norm(d.name));
    let placeholder = false;
    if (!u) {
      const given = p.data.emails[d.id]?.toLowerCase();
      const email = given || `${norm(d.name).slice(0, 24)}@dokter.estaka.invalid`;
      placeholder = !given;
      if (await findByEmail(email)) return fail("email_taken", 409, `Email ${email} sudah dipakai.`);
      u = await createUser({ email, name: d.name, role: "dokter", password: randomToken(12) + "aA1!", createdBy: a.user.id, mustChangePassword: true });
      users.push(u);
    }
    let schedule = false;
    if (!(await getSchedule(u.id))) {
      const hours = [{ start: "09:00", end: "17:00" }];
      await setSchedule(u.id, { slotMinutes: 30, poliklinikId: /konservasi/i.test(d.role.id) ? "konservasi" : "umum", days: { "0": [], "1": hours, "2": hours, "3": hours, "4": hours, "5": hours, "6": hours }, leave: [] } as never);
      schedule = true;
    }
    out.push({ name: d.name, status: placeholder || schedule ? "dibuat" : "sudah_ada", schedule, placeholderEmail: placeholder });
  }
  await audit("doctors.imported", a.user.id, { count: out.filter((x) => x.status === "dibuat").length });
  return json({ ok: true, doctors: out });
}
