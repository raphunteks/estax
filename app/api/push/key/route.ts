import { isResponse, json, requireAuth } from "@/lib/api";
import { publicKey } from "@/lib/push";

export async function GET() {
  const a = await requireAuth({ allowLocked: true });
  if (isResponse(a)) return a;
  return json({ ok: true, key: await publicKey() });
}
