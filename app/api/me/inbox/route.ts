import { isResponse, json, requireAuth } from "@/lib/api";
import { inbox } from "@/lib/push";

export async function GET() {
  const a = await requireAuth({ allowLocked: true });
  if (isResponse(a)) return a;
  return json({ ok: true, items: await inbox(a.user.id) });
}
