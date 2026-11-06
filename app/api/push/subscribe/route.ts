import { z } from "zod";
import { fail, isResponse, json, requireAuth } from "@/lib/api";
import { audit } from "@/lib/auth/guards";
import { subscribe, unsubscribe } from "@/lib/push";

const sub = z.object({ endpoint: z.string().url().max(600).startsWith("https://"), keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }) });

export async function POST(req: Request) {
  const a = await requireAuth({ allowLocked: true });
  if (isResponse(a)) return a;
  const p = sub.safeParse((await req.json().catch(() => null))?.subscription);
  if (!p.success) return fail("validation");
  await subscribe(a.user.id, p.data);
  await audit("push.subscribed", a.user.id);
  return json({ ok: true });
}
export async function DELETE(req: Request) {
  const a = await requireAuth({ allowLocked: true });
  if (isResponse(a)) return a;
  const e = z.string().url().max(600).safeParse((await req.json().catch(() => null))?.endpoint);
  if (!e.success) return fail("validation");
  await unsubscribe(a.user.id, e.data);
  return json({ ok: true });
}
