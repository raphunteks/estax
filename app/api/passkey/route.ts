import { fail, isResponse, json, requireAuth } from "@/lib/api";
import { audit } from "@/lib/auth/guards";
import { dropCred, passkeysOf, savePasskeys } from "@/lib/passkey";

export async function GET() {
  const a = await requireAuth({ allowLocked: true });
  if (isResponse(a)) return a;
  return json({ ok: true, keys: (await passkeysOf(a.user.id)).map((k) => ({ id: k.id, name: k.name, createdAt: k.createdAt, lastUsedAt: k.lastUsedAt })) });
}
export async function DELETE(req: Request) {
  const a = await requireAuth({ allowLocked: true });
  if (isResponse(a)) return a;
  const id = new URL(req.url).searchParams.get("id") ?? "";
  const keys = await passkeysOf(a.user.id);
  if (!keys.some((k) => k.id === id)) return fail("not_found", 404);
  await savePasskeys(a.user.id, keys.filter((k) => k.id !== id));
  await dropCred(id);
  await audit("passkey.removed", a.user.id);
  return json({ ok: true });
}
