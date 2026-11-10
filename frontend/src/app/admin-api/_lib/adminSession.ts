import "server-only";
import { cookies } from "next/headers";

/**
 * The admin's session in the panel (feature 009). The API gives an admin only a 15-minute access token and no
 * refresh token (specs/backend (004)), so the panel keeps that token in its own cookie:
 * - HttpOnly: page scripts never see it, so a script injected into the panel cannot take it.
 * - SameSite=Strict and Path=/admin-api: sent only to the panel's own handlers, never to a page or the API.
 * - Max-Age from the API's `expires_in`: the cookie ends when the token does; then the admin logs in again.
 * - Secure in production.
 */
export const ADMIN_COOKIE = "cv_admin";

export async function setAdminCookie(token: string, seconds: number): Promise<void> {
  (await cookies()).set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    path: "/admin-api",
    maxAge: Math.max(0, Math.floor(seconds)),
    secure: process.env.NODE_ENV === "production",
  });
}

export async function readAdminCookie(): Promise<string | undefined> {
  return (await cookies()).get(ADMIN_COOKIE)?.value;
}

export async function clearAdminCookie(): Promise<void> {
  (await cookies()).set(ADMIN_COOKIE, "", {
    httpOnly: true,
    sameSite: "strict",
    path: "/admin-api",
    maxAge: 0,
  });
}
