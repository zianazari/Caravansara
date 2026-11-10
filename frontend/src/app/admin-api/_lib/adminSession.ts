import "server-only";
import { cookies } from "next/headers";
import { callApi } from "@/app/session/_lib/session";

/**
 * The admin's session in the panel (features 009 and 011). Both tokens live only in cookies of the panel:
 * - HttpOnly: page scripts never see them, so a script injected into the panel cannot take them.
 * - SameSite=Strict and Path=/admin-api: sent only to the panel's own handlers, never to a page or the API.
 * - Secure in production.
 * `cv_admin` holds the 15-minute admin token and ends 30 seconds before it does, so an expired token is never
 * sent; `cv_admin_refresh` holds the rotating refresh token until the session ends, 8 hours after log-in
 * (the API's `session_expires_in`). When `cv_admin` is gone, the forwarder renews both before forwarding.
 */
export const ADMIN_COOKIE = "cv_admin";
export const ADMIN_REFRESH_COOKIE = "cv_admin_refresh";
const MARGIN_SECONDS = 30;

export type AdminTokens = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  session_expires_in: number;
};

const options = (maxAge: number) => ({
  httpOnly: true,
  sameSite: "strict" as const,
  path: "/admin-api",
  maxAge: Math.max(0, Math.floor(maxAge)),
  secure: process.env.NODE_ENV === "production",
});

export async function setAdminCookies(tokens: AdminTokens): Promise<void> {
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, tokens.access_token, options(tokens.expires_in - MARGIN_SECONDS));
  jar.set(ADMIN_REFRESH_COOKIE, tokens.refresh_token, options(tokens.session_expires_in));
}

export async function readAdminCookie(): Promise<string | undefined> {
  return (await cookies()).get(ADMIN_COOKIE)?.value;
}

export async function readAdminRefreshCookie(): Promise<string | undefined> {
  return (await cookies()).get(ADMIN_REFRESH_COOKIE)?.value;
}

export async function clearAdminCookies(): Promise<void> {
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, "", options(0));
  jar.set(ADMIN_REFRESH_COOKIE, "", options(0));
}

/**
 * Renewals in flight, by refresh token. The API ends every session when a refresh token is used twice, so two
 * panel requests that find the admin token gone at the same moment must share one renewal, not send the same
 * refresh token twice. This holds within one site process; several site instances behind a load balancer need
 * sticky sessions for the panel (docs/backend-design.md, «نشست مدیر با refresh (کار ۰۱۱)»).
 */
const inFlight = new Map<string, Promise<AdminTokens | null>>();

export function renewAdminTokens(request: Request, refreshToken: string): Promise<AdminTokens | null> {
  let renewal = inFlight.get(refreshToken);
  if (!renewal) {
    renewal = (async () => {
      const upstream = await callApi(request, "/admin/auth/refresh", { refresh_token: refreshToken });
      return upstream.ok ? ((await upstream.json()) as AdminTokens) : null;
    })().finally(() => setTimeout(() => inFlight.delete(refreshToken), 5_000));
    inFlight.set(refreshToken, renewal);
  }
  return renewal;
}
