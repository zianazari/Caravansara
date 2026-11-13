import { toHundredths } from "./money";

/** One unit for the entire calendar, chosen from the property's base price. */
export function calendarPriceUnit(base: string, currency: string) {
  if (currency !== "IRR") return currency;
  const amount = toHundredths(base);
  return amount >= 1_000_000_000n ? "millionToman" : amount >= 1_000_000n ? "thousandToman" : "toman";
}

/** Compact guide prices only; summaries and accessible descriptions use exact money. */
export function formatCalendarPrice(amount: string, base: string, currency: string, locale: string): string {
  const unit = calendarPriceUnit(base, currency);
  const scale = unit === "millionToman" ? 9 : unit === "thousandToman" ? 6 : unit === "toman" ? 3 : 2;
  const divisor = 10n ** BigInt(scale);
  const cents = toHundredths(amount);
  const tag = locale === "fa" ? "fa-IR-u-nu-arabext" : "en-GB";
  if (cents > 0n && cents * 1000n < divisor)
    return `<${new Intl.NumberFormat(tag, { maximumFractionDigits: 3 }).format(0.001)}`;
  const decimal = `${cents / divisor}.${(cents % divisor).toString().padStart(scale, "0")}`;
  return new Intl.NumberFormat(tag, {
    notation: currency === "IRR" ? "standard" : "compact",
    maximumFractionDigits: currency === "IRR" ? 3 : 2,
    useGrouping: false,
  }).format(decimal as unknown as number);
}
