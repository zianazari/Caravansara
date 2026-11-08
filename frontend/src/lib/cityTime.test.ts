import { formatClock, formatInZone, startOfDayInZone, todayInZone } from "./cityTime";

describe("cityTime", () => {
  it("gives today's date in the listing's city, not the browser's", () => {
    const instant = new Date("2026-06-01T21:00:00Z"); // 00:30 next day in Tehran, 17:00 in New York
    expect(todayInZone("Asia/Tehran", instant)).toBe("2026-06-02");
    expect(todayInZone("America/New_York", instant)).toBe("2026-06-01");
    expect(todayInZone("Europe/Helsinki", instant)).toBe("2026-06-02");
    expect(todayInZone("UTC")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("finds midnight in a zone, also on the days the clocks change", () => {
    expect(startOfDayInZone("2026-06-02", "Asia/Tehran").toISOString()).toBe("2026-06-01T20:30:00.000Z");
    expect(startOfDayInZone("2026-01-15", "America/New_York").toISOString()).toBe("2026-01-15T05:00:00.000Z");
    // London: summer time starts 29 March 2026 at 01:00 UTC; midnight that day is still GMT
    expect(startOfDayInZone("2026-03-29", "Europe/London").toISOString()).toBe("2026-03-29T00:00:00.000Z");
    expect(startOfDayInZone("2026-03-30", "Europe/London").toISOString()).toBe("2026-03-29T23:00:00.000Z");
    expect(startOfDayInZone("2026-10-25", "Europe/London").toISOString()).toBe("2026-10-24T23:00:00.000Z");
  });

  it("knows the moment just before and after midnight in the city", () => {
    const midnight = startOfDayInZone("2026-06-02", "Asia/Tehran");
    expect(todayInZone("Asia/Tehran", new Date(midnight.getTime() - 1000))).toBe("2026-06-01");
    expect(todayInZone("Asia/Tehran", midnight)).toBe("2026-06-02");
  });

  it("writes times in the page's digits", () => {
    expect(formatClock("15:00:00", "fa")).toBe("۱۵:۰۰");
    expect(formatClock("09:30:00", "en")).toBe("09:30");
    const shown = formatInZone(new Date("2026-06-01T20:29:00Z"), "Asia/Tehran", "en");
    expect(shown).toContain("23:59");
    expect(shown).toContain("2026");
  });
});
