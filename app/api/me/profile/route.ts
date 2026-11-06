import { z } from "zod";
import { fail, isResponse, json, requireAuth } from "@/lib/api";
import { audit } from "@/lib/auth/guards";
import { getUser, saveUser } from "@/lib/auth/users";

const body = z.object({ name: z.string().trim().min(2).max(80) });

export async function PUT(req: Request) {
  const a = await requireAuth({ allowLocked: true });
  if (isResponse(a)) return a;
  const p = body.safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("validation");
  const u = await getUser(a.user.id);
  if (!u) return fail("unauthorized", 401);
  u.name = p.data.name;
  await saveUser(u);
  await audit("profile.updated", u.id);
  return json({ ok: true });
}
