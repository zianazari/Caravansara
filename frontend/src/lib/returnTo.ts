import { routing } from "@/i18n/routing";

/**
 * Where to go after logging in (FR-014): a path inside this site, without the language prefix, which the
 * language-aware router adds back. Anything else (another site, `//host`, `/\host`, a scheme, a control
 * character, an encoded trick) becomes the home page, so the login page cannot send people to another site
 * (open redirect).
 */
export function safeReturnTo(value: string | null | undefined): string {
  const home = "/";
  if (!value) return home;
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return home;
  }
  for (const candidate of [value, decoded]) {
    if (!candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) return home;
    if (/[\u0000-\u001f]/.test(candidate)) return home;
  }
  for (const locale of routing.locales) {
    if (value === `/${locale}`) return home;
    if (value.startsWith(`/${locale}/`) || value.startsWith(`/${locale}?`)) {
      const rest = value.slice(locale.length + 1);
      return rest.startsWith("?") ? `/${rest}` : rest;
    }
  }
  return value;
}
