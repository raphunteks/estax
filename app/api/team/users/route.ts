import { z } from "zod";
import { fail, isResponse, json, requireAuth } from "@/lib/api";
import { CAN_CREATE } from "@/lib/auth/rbac";
import { audit, rateLimit } from "@/lib/auth/guards";
import { createUser, listUsers, teamView as view } from "@/lib/auth/users";
import { sendInvite } from "@/lib/auth/invite";
import { randomToken } from "@/lib/auth/crypto";


const body = z.object({
  email: z.string().email().max(120),
  name: z.string().trim().min(2).max(80),
  role: z.enum(["superadmin", "dokter", "staf", "apoteker"]),
  subRole: z.enum(["perawat", "resepsionis", "kasir"]).optional(),
});

export async function GET() {
  const a = await requireAuth();
  if (isResponse(a)) return a;
  const manageable = CAN_CREATE[a.user.role].filter((r) => r !== "pasien");
  if (!manageable.length) {
    await audit("access.denied", a.user.id, { perm: "users:read" });
    return fail("forbidden", 403);
  }
  const all = await listUsers();
  const rows = all.filter((u) => u.id === a.user.id || (manageable as string[]).includes(u.role) || (a.user.role === "superadmin" && u.role !== "pasien"));
  return json({ ok: true, users: rows.sort((x, y) => y.createdAt - x.createdAt).map(view), manageable, me: a.user.id });
}

export async function POST(req: Request) {
  const a = await requireAuth();
  if (isResponse(a)) return a;
  const p = body.safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("validation", 400, "Periksa isian formulir.");
  const { email, name, role, subRole } = p.data;
  if (!CAN_CREATE[a.user.role].includes(role)) {
    await audit("access.denied", a.user.id, { perm: "users:create", role });
    return fail("forbidden", 403);
  }
  if (role === "staf" && !subRole) return fail("validation", 400, "Pilih sub-peran staf.");
  if (!(await rateLimit("invite", a.user.id, 20, 3600))) return fail("rate_limited", 429);
  try {
    const u = await createUser({ email, name, role, subRole: role === "staf" ? subRole : undefined, password: randomToken() + "aA1", createdBy: a.user.id, mustChangePassword: true });
    const sent = await sendInvite(u);
    await audit("user.created", a.user.id, { target: u.id, role, mailSent: sent });
    return json({ ok: true, user: view(u), mailSent: sent }, 201);
  } catch (e) {
    if (e instanceof Error && e.message === "email_taken") return fail("email_taken", 409, "Email sudah terdaftar.");
    throw e;
  }
}
