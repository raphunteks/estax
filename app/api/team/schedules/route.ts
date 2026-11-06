import { isResponse, json, requireAuth, fail } from "@/lib/api";
import { audit } from "@/lib/auth/guards";
import { can } from "@/lib/auth/rbac";
import { listUsers } from "@/lib/auth/users";
import { getSchedule } from "@/lib/master";

/** Superadmin sees every doctor; a dokter only sees their own schedule (read-only). */
export async function GET() {
  const a = await requireAuth();
  if (isResponse(a)) return a;
  if (!can(a.user.role, "users:read")) {
    await audit("access.denied", a.user.id, { perm: "schedule:read" });
    return fail("forbidden", 403);
  }
  const docs = (await listUsers()).filter((u) => u.role === "dokter" && u.active && (a.user.role === "superadmin" || u.id === a.user.id));
  const rows = await Promise.all(docs.map(async (d) => ({ id: d.id, name: d.name, schedule: (await getSchedule(d.id)) ?? null })));
  return json({ ok: true, doctors: rows, canEdit: a.user.role === "superadmin" });
}
