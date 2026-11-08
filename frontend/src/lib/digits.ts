/** Persian (۰–۹) and Arabic-Indic (٠–٩) digits to Latin, so typed numbers are read in any of the three (FR-004). */
export function toLatinDigits(text: string): string {
  return text
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}

/** A whole number from user input in any digit set, or null when it is not one. */
export function parseIntInput(text: string): number | null {
  const latin = toLatinDigits(text).trim();
  if (!/^-?\d+$/.test(latin)) return null;
  const value = Number.parseInt(latin, 10);
  return Number.isSafeInteger(value) ? value : null;
}
