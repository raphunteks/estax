import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Cheap gate only: no cookie => /masuk. The real checks (revocable session, role, 2FA policy) run on the server in the layouts
 * and in every API handler, so a forged cookie never gets data.
 */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasCookie = req.cookies.has("estaka_s");
  if (!hasCookie && (pathname.startsWith("/dashboard") || pathname.startsWith("/portal"))) {
    const url = new URL("/masuk", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  const headers = new Headers(req.headers);
  headers.set("x-pathname", pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: ["/dashboard/:path*", "/portal/:path*"] };
