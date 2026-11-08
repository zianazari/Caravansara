import createIntlMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { contentSecurityPolicy, makeNonce } from "./lib/csp";
import { routing } from "./i18n/routing";

/**
 * Runs before every page (Next.js 16 renamed `middleware.ts` to `proxy.ts`; research R21).
 *
 * 1. `/api/v1/auth/*` answers 404 here, before the `/api/v1` forwarder (app/api/v1/[...path]/route.ts) sends it to the API. Log-in, sign-up, refresh
 *    and log-out go only through `/session/*`. The refresh token then never reaches page scripts (R3), and
 *    the login rate limit always sees the user's real address, which `/session/*` sets (R19).
 * 2. The language prefix (next-intl): an address without `/fa` or `/en` goes to `/fa`.
 * 3. A content security policy with a fresh nonce for every page (R21). The nonce is passed to Next.js in
 *    the request headers, so it marks its own scripts with it.
 */
const intl = createIntlMiddleware(routing);

export function proxy(request: NextRequest): NextResponse {
  if (request.nextUrl.pathname.startsWith("/api/v1/auth")) {
    return NextResponse.json({ error: { code: "not_found", message: "Not found." } }, { status: 404 });
  }
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const nonce = makeNonce();
  const csp = contentSecurityPolicy(nonce, process.env.NODE_ENV === "development");
  // next-intl copies the request headers into its rewrite, so the page render sees both (R21).
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);

  const response = intl(new NextRequest(request, { headers }));
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    // Pages, and the API prefix so `/api/v1/auth` can be refused. Not `/session` (route handlers),
    // build output, images, files with an extension, or prefetches (Next.js CSP guide).
    {
      source: "/((?!session|_next/static|_next/image|favicon.ico|.*\\..*).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
