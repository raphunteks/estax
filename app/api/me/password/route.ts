import { z } from "zod";
import { json, fail, isResponse, requireAuth } from "@/lib/api";
import { checkPassword, getUser, hashPassword, passwordProblem, saveUser } from "@/lib/auth/users";
import { revokeSessions } from "@/lib/auth/session";
import { audit, rateLimit } from "@/lib/auth/guards";

const body = z.object({ current: z.string().min(1).max(200), next: z.string().min(1).max(200) });

export async function POST(req: Request) {
  const a = await requireAuth({ allowLocked: true });
  if (isResponse(a)) return a;
  const p = body.safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("validation");
  if (!(await rateLimit("pw-change", a.user.id, 5, 900))) return fail("rate_limited", 429);
  const user = await getUser(a.user.id);
  if (!user || !(await checkPassword(user, p.data.current))) return fail("wrong_password", 401);
  const problem = passwordProblem(p.data.next, user.email);
  if (problem) return fail("weak_password", 400, problem);
  user.passHash = await hashPassword(p.data.next);
  user.mustChangePassword = false;
  await saveUser(user);
  await revokeSessions(user.id, a.sid); // other devices are signed out
  await audit("password.changed", user.id);
  return json({ ok: true });
}
