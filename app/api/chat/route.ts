import { isResponse, json, requirePerm } from "@/lib/api";
import { chatThreads } from "@/lib/clinic/engage";

export async function GET() {
  const a = await requirePerm("chat:staff");
  if (isResponse(a)) return a;
  return json({ ok: true, threads: await chatThreads() });
}
