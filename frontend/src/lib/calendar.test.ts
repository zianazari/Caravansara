import { jalaaliMonthLength } from "jalaali-js";
import {
  addDays,
  calendarOf,
  daysBetween,
  formatDate,
  formatDay,
  formatMonth,
  isWeeklyHoliday,
  jalaliToIso,
  monthGrid,
  monthOf,
  parseIso,
  shiftMonth,
  toJalali,
} from "./calendar";

const persianParts = new Intl.DateTimeFormat("en-US-u-ca-persian", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  timeZone: "UTC",
});

function intlJalali(iso: string) {
  const { y, m, d } = parseIso(iso);
  const parts = persianParts.formatToParts(new Date(Date.UTC(y, m - 1, d)));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { y: get("year"), m: get("month"), d: get("day") };
}

describe("calendar", () => {
  it("converts every day of 1400–1410 both ways, and agrees with Intl (SC-008)", () => {
    let days = 0;
    for (let jy = 1400; jy <= 1410; jy++) {
      for (let jm = 1; jm <= 12; jm++) {
        for (let jd = 1; jd <= jalaaliMonthLength(jy, jm); jd++) {
          const iso = jalaliToIso(jy, jm, jd);
          expect(toJalali(iso)).toEqual({ y: jy, m: jm, d: jd });
          expect(intlJalali(iso)).toEqual({ y: jy, m: jm, d: jd });
          days++;
        }
      }
    }
    expect(days).toBeGreaterThan(4000);
  });

  it("handles Nowruz and the last day of Esfand in a leap year", () => {
    expect(jalaliToIso(1405, 1, 1)).toBe("2026-03-21");
    expect(jalaliToIso(1403, 12, 30)).toBe("2025-03-20"); // 1403 is a leap year: Esfand has 30 days
    expect(addDays(jalaliToIso(1403, 12, 30), 1)).toBe(jalaliToIso(1404, 1, 1));
  });

  it("counts days in UTC", () => {
    expect(addDays("2026-03-28", 2)).toBe("2026-03-30");
    expect(addDays("2024-12-31", 1)).toBe("2025-01-01");
    expect(daysBetween("2026-02-27", "2026-03-02")).toBe(3);
    expect(() => parseIso("2026-3-2")).toThrow(RangeError);
  });

  it("builds Jalali months from Saturday and Gregorian months from Monday", () => {
    const farvardin = monthGrid("jalali", 1405, 1);
    expect(farvardin.flat().filter(Boolean)).toHaveLength(31);
    // 1405-01-01 is Saturday 21 March 2026: the first cell
    expect(farvardin[0]?.[0]).toBe("2026-03-21");
    const march = monthGrid("gregorian", 2026, 3);
    // 1 March 2026 is a Sunday: six blanks before it
    expect(march[0]?.slice(0, 6)).toEqual([null, null, null, null, null, null]);
    expect(march[0]?.[6]).toBe("2026-03-01");
    expect(march.every((week) => week.length === 7)).toBe(true);
  });

  it("finds and moves months", () => {
    expect(monthOf("jalali", "2026-03-21")).toEqual({ year: 1405, month: 1 });
    expect(monthOf("gregorian", "2026-03-21")).toEqual({ year: 2026, month: 3 });
    expect(shiftMonth(1404, 12, 1)).toEqual({ year: 1405, month: 1 });
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(calendarOf("fa")).toBe("jalali");
    expect(calendarOf("en")).toBe("gregorian");
  });

  it("formats with the page's calendar and digits", () => {
    expect(formatDate("2026-03-21", "fa", "long")).toBe("۱ فروردین ۱۴۰۵");
    expect(formatDate("2026-03-21", "en", "long")).toBe("21 March 2026");
    expect(formatMonth("jalali", 1405, 1, "fa")).toBe("فروردین ۱۴۰۵");
    expect(formatMonth("gregorian", 2026, 3, "en")).toBe("March 2026");
    expect(formatDay("2026-03-21", "fa")).toBe("۱");
    expect(formatDay("2026-03-21", "en")).toBe("21");
  });

  it("marks Friday on the Persian calendar and Sunday on the Gregorian one (feature 038)", () => {
    // 2026-03-21 (1 Farvardin 1405) is a Saturday.
    expect(isWeeklyHoliday("jalali", "2026-03-27")).toBe(true); // Friday
    expect(isWeeklyHoliday("jalali", "2026-03-22")).toBe(false); // Sunday
    expect(isWeeklyHoliday("gregorian", "2026-03-22")).toBe(true); // Sunday
    expect(isWeeklyHoliday("gregorian", "2026-03-27")).toBe(false); // Friday
  });
});
