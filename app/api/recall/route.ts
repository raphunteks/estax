import { isResponse, json, requirePerm } from "@/lib/api";
import { openRecalls } from "@/lib/clinic/care";

export async function GET() {
  const a = await requirePerm("recall:manage");
  if (isResponse(a)) return a;
  return json({ ok: true, rows: await openRecalls(a.user.role === "dokter" ? a.user.id : undefined) });
}
