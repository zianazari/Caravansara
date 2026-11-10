/**
 * Money from the API, shown in the listing's own currency, never converted (FR-007, research R10).
 *
 * Amounts arrive as decimal strings (Pydantic sends Decimal as a string; columns are NUMERIC(14,2)). They are
 * never turned into a binary `number`: the arithmetic is done on whole hundredths with BigInt, and Intl
 * formats the exact decimal string.
 *
 * Rial (IRR) is shown as toman, one tenth of a rial, without decimals unless the rial amount is not a
 * multiple of ten (owner decision, 2026-11-08). The data and the API stay in rial.
 */
const TAG: Record<string, string> = { fa: "fa-IR-u-nu-arabext", en: "en-GB" };

/** "123.45" → 12345n hundredths. */
export function toHundredths(amount: string): bigint {
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(amount.trim());
  if (!match) throw new RangeError(`Not a money amount: ${amount}`);
  const [, sign, whole, fraction = ""] = match;
  const value = BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, "0"));
  return sign ? -value : value;
}

/** An exact decimal string with `scale` digits after the point, trailing zeros removed. */
function decimal(units: bigint, scale: number): string {
  const negative = units < 0n;
  const digits = (negative ? -units : units).toString().padStart(scale + 1, "0");
  const whole = digits.slice(0, digits.length - scale);
  const fraction = digits.slice(digits.length - scale).replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

/** Rial hundredths to toman as an exact decimal: one tenth, so up to three digits after the point. */
export function rialToToman(amount: string): string {
  return decimal(toHundredths(amount), 3);
}

export function formatMoney(amount: string, currency: string, locale: string, tomanLabel: string): string {
  const tag = TAG[locale] ?? locale;
  if (currency === "IRR") {
    const number = new Intl.NumberFormat(tag, { maximumFractionDigits: 3 }).format(
      rialToToman(amount) as unknown as number, // Intl formats a decimal string exactly
    );
    return `${number} ${tomanLabel}`;
  }
  return new Intl.NumberFormat(tag, { style: "currency", currency }).format(
    decimal(toHundredths(amount), 2) as unknown as number,
  );
}

/** Sum of amounts in hundredths, for the price breakdown before booking (FR-023). */
export function multiply(amount: string, times: number): string {
  return decimal(toHundredths(amount) * BigInt(times), 2);
}

export function add(...amounts: string[]): string {
  return decimal(
    amounts.reduce((sum, a) => sum + toHundredths(a), 0n),
    2,
  );
}

/** The API's limit for a nightly price or a cleaning fee, in any currency (specs/backend (002)). */
export const MAX_AMOUNT = "1000000000.00";

const PERSIAN = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC = "٠١٢٣٤٥٦٧٨٩";

/**
 * What a host typed into a price field (specs/008-host-pages, research R7): Persian or Arabic digits, the
 * Persian decimal mark and thousands separators are accepted. Returns a plain decimal string with at most two
 * decimals, or null when it is not a number.
 */
export function parseAmountInput(text: string): string | null {
  const plain = [...text.trim()]
    .map((c) => {
      const p = PERSIAN.indexOf(c);
      if (p >= 0) return String(p);
      const a = ARABIC.indexOf(c);
      if (a >= 0) return String(a);
      return c === "٫" ? "." : c;
    })
    .join("")
    .replace(/[,٬\s]/g, "");
  return /^\d+(\.\d{1,2})?$/.test(plain) ? plain : null;
}

/**
 * Toman typed by a host to rial for the API, exactly (×10 on whole hundredths), or null over the API's limit.
 * The site shows rial as toman everywhere (owner decision, 2026-11-08), so the host types toman too.
 */
export function tomanToRial(toman: string): string | null {
  const rial = toHundredths(toman) * 10n;
  if (rial > toHundredths(MAX_AMOUNT)) return null;
  return decimal(rial, 2)
    .replace(/^(\d+)$/, "$1.00")
    .replace(/^(\d+\.\d)$/, "$10");
}
