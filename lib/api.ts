import { NextResponse } from "next/server";
import { getAuth, type Auth } from "@/lib/auth/session";
import { twoFaRequired } from "@/lib/auth/users";
import { can } from "@/lib/auth/rbac";
import { audit } from "@/lib/auth/guards";

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
export const fail = (code: string, status = 400, message?: string) => json({ ok: false, code, message }, status);

/**
 * Resolves the session or returns an error response. Accounts that still owe a forced password change or mandatory 2FA are
 * blocked here too (not only in the layout); only /api/me/* opts in with `allowLocked`.
 */
export async function requireAuth(opts: { allowLocked?: boolean } = {}): Promise<Auth | NextResponse> {
  const a = await getAuth();
  if (!a) return fail("unauthorized", 401);
  if (!opts.allowLocked && (a.user.mustChangePassword || ((await twoFaRequired(a.user.role)) && !a.user.totpEnabled))) return fail("setup_required", 403);
  return a;
}

/** requireAuth + permission check. A denied call is a 403 and is written to the audit log. */
export async function requirePerm(perm: string): Promise<Auth | NextResponse> {
  const a = await requireAuth();
  if (isResponse(a)) return a;
  if (!can(a.user.role, perm)) {
    await audit("access.denied", a.user.id, { perm });
    return fail("forbidden", 403);
  }
  return a;
}
export const isResponse = (x: unknown): x is NextResponse => x instanceof NextResponse;
