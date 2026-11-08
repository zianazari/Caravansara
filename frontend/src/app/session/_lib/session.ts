import "server-only";
import { cookies } from "next/headers";
import { apiInternalUrl, clientAddress } from "@/lib/server/upstream";

/**
 * Shared code of the `/session/*` route handlers (research R3, contracts/web.md).
 *
 * The refresh token lives only in the `cv_refresh` cookie:
 * - HttpOnly: page scripts cannot read it, so an XSS cannot steal a 30-day session (FR-012).
 * - SameSite=Strict and Path=/session: the browser sends it only to these handlers on this site, so no other
 *   request carries it and another site cannot make the browser use it.
 * - Secure in production: never over plain http.
 * The page gets only the 15-minute access token, which it keeps in memory.
 */
export const REFRESH_COOKIE = "cv_refresh";
const THIRTY_DAYS = 30 * 24 * 60 * 60; // the API's refresh_token_days

export type ApiError = { error: { code: string; message: string; details?: unknown } };

export function errorResponse(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } } satisfies ApiError, { status });
}

/**
 * A POST must come from a page of this site. With SameSite=Strict this is a second lock against another
 * site posting here; a request without an Origin header (not sent by a browser form) is refused too.
 */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function setRefreshCookie(token: string): Promise<void> {
  (await cookies()).set(REFRESH_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    path: "/session",
    maxAge: THIRTY_DAYS,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function readRefreshCookie(): Promise<string | undefined> {
  return (await cookies()).get(REFRESH_COOKIE)?.value;
}

export async function clearRefreshCookie(): Promise<void> {
  (await cookies()).set(REFRESH_COOKIE, "", {
    httpOnly: true,
    sameSite: "strict",
    path: "/session",
    maxAge: 0,
  });
}

/** Calls the API from the server with the visitor's address (research R19). No body or token is logged. */
export async function callApi(request: Request, path: string, body: unknown): Promise<Response> {
  const headers = new Headers({ "content-type": "application/json", accept: "application/json" });
  const address = clientAddress(request.headers);
  if (address) headers.set("x-forwarded-for", address);
  try {
    return await fetch(`${apiInternalUrl()}/api/v1${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    return errorResponse(503, "service_unavailable", "The service is not reachable.");
  }
}

/** Passes an API error on with the same status and body, so the page shows the translated message. */
export async function passError(upstream: Response): Promise<Response> {
  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
  });
}

type Tokens = { access_token: string; refresh_token: string; expires_in: number };

/** Keeps the refresh token in the cookie and returns only what the page may hold. */
export async function issue(
  tokens: Tokens,
  extra: Record<string, unknown> = {},
  status = 200,
): Promise<Response> {
  await setRefreshCookie(tokens.refresh_token);
  return Response.json(
    { access_token: tokens.access_token, expires_in: tokens.expires_in, ...extra },
    { status, headers: { "cache-control": "no-store" } },
  );
}
