/**
 * Time in the listing's city (FR-006, research R9). The API decides cancellation and review windows by the
 * date in the listing city's time zone (bookings/service.py and reviews/service.py, `today_in(timezone)`), so
 * the site shows and checks the same dates, never by the browser's clock zone.
 */

function partsIn(tz: string, instant: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return {
    y: get("year"),
    m: get("month"),
    d: get("day"),
    h: get("hour"),
    min: get("minute"),
    s: get("second"),
  };
}

/** Today's date (YYYY-MM-DD) in a time zone. */
export function todayInZone(tz: string, now: Date = new Date()): string {
  const p = partsIn(tz, now);
  return `${String(p.y).padStart(4, "0")}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

/** How far a zone's wall clock is ahead of UTC at an instant, in milliseconds. */
function offsetMs(tz: string, instant: Date): number {
  const p = partsIn(tz, instant);
  const wall = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s);
  return wall - Math.floor(instant.getTime() / 1000) * 1000;
}

/**
 * The instant a calendar day starts in a zone. The offset is checked twice, so a day on which the clocks
 * change (London in March and October) still gets its true midnight.
 */
export function startOfDayInZone(iso: string, tz: string): Date {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const wallMidnight = Date.UTC(y, m - 1, d);
  let guess = wallMidnight - offsetMs(tz, new Date(wallMidnight));
  guess = wallMidnight - offsetMs(tz, new Date(guess));
  return new Date(guess);
}

const TAG: Record<string, string> = { fa: "fa-IR-u-ca-persian-nu-arabext", en: "en-GB" };

/** A wall-clock time from the API ("15:00:00") in the page's digits; the caller names the city. */
export function formatClock(time: string, locale: string): string {
  const [h = 0, min = 0] = time.split(":").map(Number);
  return new Intl.DateTimeFormat(TAG[locale] ?? locale, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2000, 0, 1, h, min)));
}

/** An instant as date and time in the listing's zone, with the zone's name. */
export function formatInZone(instant: Date, tz: string, locale: string): string {
  return new Intl.DateTimeFormat(TAG[locale] ?? locale, {
    timeZone: tz,
    dateStyle: "long",
    timeStyle: "short",
  }).format(instant);
}
