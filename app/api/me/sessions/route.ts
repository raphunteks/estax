import { json, isResponse, requireAuth } from "@/lib/api";
import { listSessions, revokeSessions } from "@/lib/auth/session";
import { audit } from "@/lib/auth/guards";

export async function GET() {
  const a = await requireAuth({ allowLocked: true });
  if (isResponse(a)) return a;
  const list = await listSessions(a.user.id);
  return json({ ok: true, sessions: list.map((s) => ({ current: s.sid === a.sid, ua: s.ua, ip: s.ip, last: s.last, created: s.created })) });
}
export async function DELETE() {
  const a = await requireAuth({ allowLocked: true });
  if (isResponse(a)) return a;
  await revokeSessions(a.user.id, a.sid);
  await audit("sessions.revoked", a.user.id);
  return json({ ok: true });
}
