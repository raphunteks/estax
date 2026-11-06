import { fail, isResponse, json, requirePerm } from "@/lib/api";
import { audit } from "@/lib/auth/guards";
import { getInvoice, mutate, patchSchema } from "@/lib/clinic/billing";
import { present } from "../route";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await requirePerm("billing:read");
  if (isResponse(a)) return a;
  const i = await getInvoice((await params).id);
  return i ? json({ ok: true, invoice: (await present([i]))[0] }) : fail("not_found", 404);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await requirePerm("billing:write");
  if (isResponse(a)) return a;
  const p = patchSchema.safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("validation", 400, p.error.issues[0]?.message);
  const id = (await params).id;
  const r = await mutate(id, p.data, { id: a.user.id, role: a.user.role });
  if (!r.ok) return fail(r.code, r.status, r.message);
  const what = p.data.pay ? "invoice.paid" : p.data.voidRequest ? "invoice.void-requested" : p.data.voidDecide || p.data.voidNow ? "invoice.void" : "invoice.edited";
  await audit(what, a.user.id, { invoice: id, ...(p.data.pay ? { amount: p.data.pay.amount, method: p.data.pay.method } : {}) });
  return json({ ok: true, invoice: (await present([r.inv]))[0] });
}
