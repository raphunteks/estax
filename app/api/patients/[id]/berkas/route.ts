import { isResponse, json, requirePerm } from "@/lib/api";
import { pfList } from "@/app/api/portal/berkas/route";

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await requirePerm("patients:read");
  if (isResponse(a)) return a;
  return json({ ok: true, files: await pfList((await ctx.params).id) });
}
