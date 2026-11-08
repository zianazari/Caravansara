/**
 * Names of the system's fixed catalog in the page's language (FR-002, research R11). The API sends English
 * names; translated ones come from the messages, and a name without a translation (a city added later) is
 * shown as the API sends it. Country names come from Intl.
 */
type Has = { has: (key: string) => boolean } & ((key: string) => string);

export function cityName(t: Has, name: string): string {
  return t.has(`cities.${name}`) ? t(`cities.${name}`) : name;
}

export function amenityName(t: Has, name: string): string {
  return t.has(`amenities.${name}`) ? t(`amenities.${name}`) : name;
}

export function amenityCategoryName(t: Has, name: string): string {
  return t.has(`amenityCategories.${name}`) ? t(`amenityCategories.${name}`) : name;
}

export function countryName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}
