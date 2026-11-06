import { z } from "zod";
import { json, fail } from "@/lib/api";
import { getUser, hashPassword, passwordProblem, saveUser } from "@/lib/auth/users";
import { revokeSessions } from "@/lib/auth/session";
import { audit, rateLimit } from "@/lib/auth/guards";
import { sha256 } from "@/lib/auth/crypto";
import { db } from "@/lib/db/store";

const body = z.object({ token: z.string().min(20).max(100), password: z.string().min(1).max(200) });

export async function POST(req: Request) {
  const p = body.safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("validation");
  const key = `reset:${sha256(p.data.token)}`;
  if (!(await rateLimit("reset", sha256(p.data.token).slice(0, 16), 10, 900))) return fail("rate_limited", 429);
  const uid = await db().get<string>(key);
  const user = uid ? await getUser(uid) : null;
  if (!user) return fail("invalid_token", 400);
  const problem = passwordProblem(p.data.password, user.email);
  if (problem) return fail("weak_password", 400, problem);

  user.passHash = await hashPassword(p.data.password);
  user.mustChangePassword = false;
  await saveUser(user);
  await db().del(key); // single use
  await revokeSessions(user.id);
  await audit("password.reset", user.id);
  return json({ ok: true });
}
