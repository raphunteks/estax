import { json, isResponse, requireAuth } from "@/lib/api";
import { newSetup } from "@/lib/auth/totp";
import { db } from "@/lib/db/store";

export async function POST() {
  const a = await requireAuth({ allowLocked: true });
  if (isResponse(a)) return a;
  const s = await newSetup(a.user.email);
  await db().set(`totp:pending:${a.user.id}`, s.enc, { ex: 600 });
  return json({ ok: true, qr: s.qr, secret: s.secret });
}
