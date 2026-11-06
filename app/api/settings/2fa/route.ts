import { z } from "zod";
import { fail, isResponse, json, requirePerm } from "@/lib/api";
import { audit } from "@/lib/auth/guards";
import { ROLES, type Role } from "@/lib/auth/rbac";
import { twoFaRequired } from "@/lib/auth/users";
import { db } from "@/lib/db/store";

const body = z.object({ staf: z.boolean(), apoteker: z.boolean(), pasien: z.boolean() });

export async function GET() {
  const a = await requirePerm("settings:read");
  if (isResponse(a)) return a;
  const policy = Object.fromEntries(await Promise.all(ROLES.map(async (r) => [r, await twoFaRequired(r)]))) as Record<Role, boolean>;
  return json({ ok: true, policy });
}

/** Superadmin and dokter stay mandatory; only the other roles are configurable. */
export async function PUT(req: Request) {
  const a = await requirePerm("settings:write");
  if (isResponse(a)) return a;
  const p = body.safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("validation");
  await db().set("policy:2fa", { superadmin: true, dokter: true, ...p.data });
  await audit("policy.2fa", a.user.id, p.data);
  return json({ ok: true });
}
