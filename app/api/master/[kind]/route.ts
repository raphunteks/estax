import { fail, isResponse, json, requireAuth, requirePerm } from "@/lib/api";
import { audit } from "@/lib/auth/guards";
import { KINDS, getMaster, setMaster, type Kind } from "@/lib/master";

const isKind = (k: string): k is Kind => k in KINDS;

export async function GET(_: Request, ctx: { params: Promise<{ kind: string }> }) {
  const a = await requireAuth();
  if (isResponse(a)) return a;
  const { kind } = await ctx.params;
  if (!isKind(kind)) return fail("not_found", 404);
  return json({ ok: true, data: await getMaster(kind) });
}

export async function PUT(req: Request, ctx: { params: Promise<{ kind: string }> }) {
  const a = await requirePerm("settings:write");
  if (isResponse(a)) return a;
  const { kind } = await ctx.params;
  if (!isKind(kind)) return fail("not_found", 404);
  const p = KINDS[kind].safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("validation", 400, p.error.issues[0]?.message);
  await setMaster(kind, p.data);
  await audit(`master.${kind}`, a.user.id);
  return json({ ok: true });
}
