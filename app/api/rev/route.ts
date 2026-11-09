import { isResponse, json, requireAuth } from "@/lib/api";
import { currentRev } from "@/lib/db/store";

export const dynamic = "force-dynamic";

/** Live-sync heartbeat: one authenticated read of the data revision counter. Clients refresh only when the number moves. */
export async function GET() {
  const a = await requireAuth();
  if (isResponse(a)) return a;
  return json({ ok: true, rev: await currentRev() });
}
