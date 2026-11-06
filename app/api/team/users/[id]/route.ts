import { z } from "zod";
import { fail, isResponse, json, requireAuth } from "@/lib/api";
import { CAN_CREATE } from "@/lib/auth/rbac";
import { audit, rateLimit } from "@/lib/auth/guards";
import { getUser, saveUser, teamView as view } from "@/lib/auth/users";
import { revokeSessions } from "@/lib/auth/session";
import { sendInvite } from "@/lib/auth/invite";


const body = z.object({ action: z.enum(["deactivate", "activate", "reset2fa", "resend"]) });

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await requireAuth();
  if (isResponse(a)) return a;
  const p = body.safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("validation");
  const target = await getUser((await ctx.params).id);
  // Same answer for "missing" and "not yours" so ids cannot be probed.
  if (!target || target.id === a.user.id || target.role === "pasien" || !CAN_CREATE[a.user.role].includes(target.role)) {
    if (target) await audit("access.denied", a.user.id, { perm: "users:manage", target: target.id });
    return fail("forbidden", 403);
  }
  if (!(await rateLimit("user-manage", a.user.id, 60, 3600))) return fail("rate_limited", 429);

  let mailSent: boolean | undefined;
  switch (p.data.action) {
    case "deactivate":
      target.active = false;
      await saveUser(target);
      await revokeSessions(target.id); // immediate; data stays
      break;
    case "activate":
      target.active = true;
      await saveUser(target);
      break;
    case "reset2fa":
      target.totpEnabled = false;
      target.totpSecretEnc = undefined;
      target.backupHashes = [];
      target.lastTotpStep = 0;
      await saveUser(target);
      await revokeSessions(target.id);
      break;
    case "resend":
      if (!target.mustChangePassword) return fail("not_pending", 409, "Akun sudah aktif.");
      mailSent = await sendInvite(target);
      break;
  }
  await audit(`user.${p.data.action}`, a.user.id, { target: target.id });
  return json({ ok: true, user: view(target), mailSent });
}
