import { fail, isResponse, json, requirePerm } from "@/lib/api";
import { audit } from "@/lib/auth/guards";
import { getTariffs, setTariffs, tariffsSchema } from "@/lib/clinic/billing";

export async function GET() {
  const a = await requirePerm("billing:read");
  if (isResponse(a)) return a;
  return json({ ok: true, tariffs: await getTariffs(), canEdit: a.user.role === "superadmin" });
}
/** Price list is a master record: superadmin only. */
export async function PUT(req: Request) {
  const a = await requirePerm("billing:write");
  if (isResponse(a)) return a;
  if (a.user.role !== "superadmin") return fail("forbidden", 403);
  const p = tariffsSchema.safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("validation", 400, p.error.issues[0]?.message);
  await setTariffs(p.data);
  await audit("tariffs.updated", a.user.id, { count: p.data.length });
  return json({ ok: true });
}
