import { z } from "zod";
import { fail, isResponse, json, requireAuth } from "@/lib/api";
import { rateLimit } from "@/lib/auth/guards";
import { chatMessages, sendChat, textSchema } from "@/lib/clinic/engage";
import { ownIds } from "@/lib/clinic/family";
import { db } from "@/lib/db/store";

/** One thread per account, anchored on the first (own) patient record. */
const pid = async (uid: string) => (await ownIds(uid))[0] ?? null;
export async function GET() {
  const a = await requireAuth();
  if (isResponse(a)) return a;
  if (a.user.role !== "pasien") return fail("forbidden", 403);
  const id = await pid(a.user.id);
  if (!id) return json({ ok: true, messages: [] });
  await db().set(`chat:pread:${id}`, Date.now());
  return json({ ok: true, messages: await chatMessages(id) });
}
export async function POST(req: Request) {
  const a = await requireAuth();
  if (isResponse(a)) return a;
  if (a.user.role !== "pasien") return fail("forbidden", 403);
  const p = z.object({ text: textSchema }).safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("validation", 400, "Tulis pesan (maks 500 karakter).");
  if (!(await rateLimit("chat", a.user.id, 30, 3600))) return fail("rate_limited", 429, "Terlalu banyak pesan. Coba lagi nanti.");
  const id = await pid(a.user.id);
  if (!id) return fail("no_patient", 409, "Lengkapi data pasien lebih dulu.");
  return json({ ok: true, message: await sendChat(id, "pasien", { id: a.user.id, name: a.user.name }, p.data.text) }, 201);
}
