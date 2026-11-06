import { fail, isResponse, requireAuth } from "@/lib/api";
import { readObject } from "@/lib/storage";

/** Own photo, or any photo for clinic staff. Patients never see other users' photos. No public URL exists. */
export async function GET(_: Request, ctx: { params: Promise<{ uid: string }> }) {
  const a = await requireAuth({ allowLocked: true });
  if (isResponse(a)) return a;
  const { uid } = await ctx.params;
  if (!/^[A-Za-z0-9_-]{6,40}$/.test(uid) || (uid !== a.user.id && a.user.role === "pasien")) return fail("forbidden", 403);
  const o = await readObject(`avatar/${uid}`);
  if (!o) return fail("not_found", 404);
  return new Response(o.body, { headers: { "Content-Type": o.type, "Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff" } });
}
