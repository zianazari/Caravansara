import faNames from "./city-names-fa.json";

/**
 * City search in Persian (feature 028). The API knows cities by their English names only, and the Persian
 * names live in the site's messages (research R11), so Persian typing is matched here: against the Persian
 * names, giving the English names to fetch from GET /cities. A city without a Persian name (one added later)
 * is still found by its English name.
 */

const ANY_PERSIAN = /[؀-ۿ]/;

/** True when the text has Persian or Arabic letters, so it is matched against the Persian names. */
export function hasPersian(text: string): boolean {
  return ANY_PERSIAN.test(text);
}

/**
 * One spelling for the ways the same Persian word is typed: Arabic yeh and kaf (an Arabic keyboard), alef
 * with madda or hamza, teh marbuta and heh with yeh, diacritics, tatweel, and the half-space (ZWNJ), which
 * people type or leave out, as in «نیو یورک» and «نیویورک».
 */
export function normalizePersian(text: string): string {
  return text
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[آأإٱ]/g, "ا")
    .replace(/[ةۀ]/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/[ً-ٰٟـ]/g, "") // diacritics and tatweel
    .replace(/[‌‏\s]+/g, "")
    .toLowerCase();
}

/**
 * English names of the cities whose Persian name starts with the typed text, in Persian order, at most
 * `limit`. Spaces and half-spaces do not matter, so «نیو» and «نیویو» both find New York City.
 */
export function persianCityMatches(
  text: string,
  limit = 8,
  names: Record<string, string> = faNames,
): string[] {
  const typed = normalizePersian(text);
  if (!typed) return [];
  return Object.entries(names)
    .filter(([, fa]) => normalizePersian(fa).startsWith(typed))
    .sort(([, a], [, b]) => a.localeCompare(b, "fa"))
    .slice(0, limit)
    .map(([en]) => en);
}
