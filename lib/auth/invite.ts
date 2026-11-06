import "server-only";
import { randomToken, sha256 } from "./crypto";
import { db } from "@/lib/db/store";
import { inviteEmail, sendMail, siteUrl } from "@/lib/mail";
import type { User } from "./users";

/** Invite = single-use password-set link (reuses the reset flow), valid 72h. Returns false when the mail could not be sent. */
export async function sendInvite(u: Pick<User, "id" | "email" | "name" | "role">): Promise<boolean> {
  const token = randomToken();
  await db().set(`reset:${sha256(token)}`, u.id, { ex: 72 * 3600 });
  const m = inviteEmail(`${siteUrl()}/atur-sandi/${token}`, u.name, u.role);
  try {
    await sendMail(u.email, m.subject, m.html, m.text);
    return true;
  } catch {
    return false;
  }
}
