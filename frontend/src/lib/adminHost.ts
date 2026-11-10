/**
 * The admin panel's own host (specs: feature 009, owner decision 2026-11-10: the same app, answering only for
 * the admin subdomain). `ADMIN_HOST` is read at run time, e.g. `admin.caravansara.example` in production or
 * `admin.localhost:3001` in development. Unset, there is no admin panel anywhere, which is the safe default.
 *
 * The public site never links to it (constitution, principle V); the unlinked address only lowers exposure,
 * the protection is the admin login.
 */
export function adminHost(env: Record<string, string | undefined> = process.env): string | undefined {
  const host = env.ADMIN_HOST?.trim().toLowerCase();
  return host || undefined;
}

/** Whether a request came to the admin host, by its Host header (or the proxy's X-Forwarded-Host). */
export function isAdminRequest(headers: Headers, env?: Record<string, string | undefined>): boolean {
  const admin = adminHost(env);
  if (!admin) return false;
  const host = (headers.get("x-forwarded-host") ?? headers.get("host") ?? "").trim().toLowerCase();
  return host === admin;
}

/** The parts of the app that belong to the admin panel, without the language prefix. */
export function isAdminPath(pathname: string): boolean {
  return /^\/(fa|en)\/admin(\/|$)/.test(pathname) || /^\/admin(-api)?(\/|$)/.test(pathname);
}
