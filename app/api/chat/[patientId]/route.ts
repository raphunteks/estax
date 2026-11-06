import { z } from "zod";
import { fail, isResponse, json, requirePerm } from "@/lib/api";
import { audit, rateLimit } from "@/lib/auth/guards";
import { chatMessages, markStaffRead, sendChat, textSchema } from "@/lib/clinic/engage";
import { getPatient } from "@/lib/clinic/patients";

export async function GET(_: Request, ctx: { params: Promise<{ patientId: string }> }) {
  const a = await requirePerm("chat:staff");
  if (isResponse(a)) return a;
  const id = (await ctx.params).patientId;
  const p = await getPatient(id);
  if (!p) return fail("not_found", 404);
  await markStaffRead(id);
  return json({ ok: true, patient: { name: p.name, rmNo: p.rmNo ?? null }, messages: await chatMessages(id) });
}
export async function POST(req: Request, ctx: { params: Promise<{ patientId: string }> }) {
  const a = await requirePerm("chat:staff");
  if (isResponse(a)) return a;
  const b = z.object({ text: textSchema }).safeParse(await req.json().catch(() => null));
  if (!b.success) return fail("validation");
  if (!(await rateLimit("chat-staff", a.user.id, 200, 3600))) return fail("rate_limited", 429);
  const id = (await ctx.params).patientId;
  if (!(await getPatient(id))) return fail("not_found", 404);
  const m = await sendChat(id, "klinik", { id: a.user.id, name: a.user.name }, b.data.text);
  await audit("chat.replied", a.user.id, { patient: id });
  return json({ ok: true, message: m }, 201);
}
