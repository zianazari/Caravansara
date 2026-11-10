import createClient from "openapi-fetch";
import type { paths } from "./schema";

/**
 * The admin panel's API client (feature 009), typed from backend/openapi.json like the site's. Requests go to
 * the panel's forwarder (`/admin-api/api/v1/admin/*`), which adds the admin token from its HttpOnly cookie, so
 * this client never holds a token. A 401 means the 15-minute admin session has ended: the page then asks to
 * log in again.
 */
export const adminApi = createClient<paths>({
  baseUrl: `${typeof window === "undefined" ? "" : window.location.origin}/admin-api`,
  credentials: "same-origin",
  // Read at call time, not when this module loads, so a test (or a polyfill) can replace fetch.
  fetch: (request: Request) => globalThis.fetch(request),
});

export async function adminLogin(email: string, password: string): Promise<Response> {
  return fetch("/admin-api/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

export async function adminLogout(): Promise<void> {
  await fetch("/admin-api/logout", { method: "POST" });
}
