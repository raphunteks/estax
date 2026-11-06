import { json } from "@/lib/api";
import { endCurrentSession, getAuth } from "@/lib/auth/session";
import { audit } from "@/lib/auth/guards";

export async function POST() {
  const a = await getAuth();
  await endCurrentSession();
  if (a) await audit("logout", a.user.id);
  return json({ ok: true });
}
