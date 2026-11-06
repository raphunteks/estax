import { fail, isResponse, json, requirePerm } from "@/lib/api";
import { audit } from "@/lib/auth/guards";
import { getUser } from "@/lib/auth/users";
import { scheduleSchema, setSchedule } from "@/lib/master";

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await requirePerm("settings:write");
  if (isResponse(a)) return a;
  const { id } = await ctx.params;
  const d = await getUser(id);
  if (!d || d.role !== "dokter") return fail("not_found", 404);
  const p = scheduleSchema.safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("validation", 400, p.error.issues[0]?.message);
  await setSchedule(id, p.data);
  await audit("schedule.updated", a.user.id, { doctor: id });
  return json({ ok: true });
}
