import { jalaaliMonthLength, toGregorian, toJalaali } from "jalaali-js";

/**
 * Dates for the date picker (research R8). The API always gets a Gregorian `YYYY-MM-DD`; Persian pages show
 * the Jalali calendar (owner decision, 2026-11-07). Display uses Intl; jalaali-js only converts, because
 * a month grid needs the exact length and first weekday of a Jalali month.
 */
export type Calendar = "jalali" | "gregorian";
export type YMD = { y: number; m: number; d: number };

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

export function parseIso(iso: string): YMD {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) throw new RangeError(`Not a YYYY-MM-DD date: ${iso}`);
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

export function toIso({ y, m, d }: YMD): string {
  return `${pad(y, 4)}-${pad(m)}-${pad(d)}`;
}

/** Days are counted in UTC, so no local time zone or daylight saving shift can move a date. */
export function addDays(iso: string, days: number): string {
  const { y, m, d } = parseIso(iso);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return toIso({ y: date.getUTCFullYear(), m: date.getUTCMonth() + 1, d: date.getUTCDate() });
}

export function daysBetween(fromIso: string, toIsoDate: string): number {
  const a = parseIso(fromIso);
  const b = parseIso(toIsoDate);
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000);
}

export function toJalali(iso: string): YMD {
  const { y, m, d } = parseIso(iso);
  const j = toJalaali(y, m, d);
  return { y: j.jy, m: j.jm, d: j.jd };
}

export function jalaliToIso(jy: number, jm: number, jd: number): string {
  const g = toGregorian(jy, jm, jd);
  return toIso({ y: g.gy, m: g.gm, d: g.gd });
}

/** Weekday of a Gregorian date: 0 = Sunday … 6 = Saturday. */
function weekday(iso: string): number {
  const { y, m, d } = parseIso(iso);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/**
 * Weeks of one month as Gregorian ISO dates, with null for blank cells. Jalali weeks start on Saturday, as
 * Iranian calendars do; Gregorian weeks start on Monday, the ISO 8601 and European custom of the English site.
 */
export function monthGrid(calendar: Calendar, year: number, month: number): (string | null)[][] {
  const first = calendar === "jalali" ? jalaliToIso(year, month, 1) : toIso({ y: year, m: month, d: 1 });
  const length =
    calendar === "jalali" ? jalaaliMonthLength(year, month) : new Date(Date.UTC(year, month, 0)).getUTCDate();
  const weekStart = calendar === "jalali" ? 6 : 1;
  const lead = (weekday(first) - weekStart + 7) % 7;

  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let i = 0; i < length; i++) cells.push(addDays(first, i));
  while (cells.length % 7) cells.push(null);

  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** The month (in the given calendar) that contains a date. */
export function monthOf(calendar: Calendar, iso: string): { year: number; month: number } {
  if (calendar === "jalali") {
    const j = toJalali(iso);
    return { year: j.y, month: j.m };
  }
  const g = parseIso(iso);
  return { year: g.y, month: g.m };
}

export function shiftMonth(year: number, month: number, by: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + by;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export function calendarOf(locale: string): Calendar {
  return locale === "fa" ? "jalali" : "gregorian";
}

const LOCALE_TAG: Record<string, string> = { fa: "fa-IR-u-ca-persian-nu-arabext", en: "en-GB" };

/** A date for reading, in the page's calendar and digits. The date is a calendar day, so it is shown in UTC. */
export function formatDate(
  iso: string,
  locale: string,
  style: "long" | "medium" | "short" = "medium",
): string {
  const { y, m, d } = parseIso(iso);
  return new Intl.DateTimeFormat(LOCALE_TAG[locale] ?? locale, { dateStyle: style, timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

/**
 * Name of a month in the page's calendar, with the year, for the picker header. Built from parts so Persian
 * reads "فروردین ۱۴۰۵" (month first), as Iranian calendars write it; Intl alone puts the year first.
 */
export function formatMonth(calendar: Calendar, year: number, month: number, locale: string): string {
  const iso = calendar === "jalali" ? jalaliToIso(year, month, 1) : toIso({ y: year, m: month, d: 1 });
  const { y, m, d } = parseIso(iso);
  const parts = new Intl.DateTimeFormat(LOCALE_TAG[locale] ?? locale, {
    year: "numeric",
    month: "long",
    timeZone: "UTC",
  }).formatToParts(new Date(Date.UTC(y, m - 1, d)));
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("month")} ${part("year")}`;
}

/** Day of month in the page's calendar and digits, for a grid cell. */
export function formatDay(iso: string, locale: string): string {
  const { y, m, d } = parseIso(iso);
  return new Intl.DateTimeFormat(LOCALE_TAG[locale] ?? locale, { day: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}
