import { fail, isResponse, json, requireAuth } from "@/lib/api";
import { MONITOR_ROLES, farmasiBoard } from "@/lib/clinic/monitor";

export const dynamic = "force-dynamic";
export async function GET() {
  const a = await requireAuth();
  if (isResponse(a)) return a;
  if (!MONITOR_ROLES.includes(a.user.role)) return fail("forbidden", 403);
  return json({ ok: true, board: await farmasiBoard() });
}
