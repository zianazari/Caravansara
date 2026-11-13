import { calendarPriceUnit, formatCalendarPrice } from "./calendarPrice";

describe("calendar guide prices", () => {
  it.each([
    ["20000000", "IRR", "millionToman"],
    ["9999999.99", "IRR", "thousandToman"],
    ["10000", "IRR", "thousandToman"],
    ["9999.99", "IRR", "toman"],
    ["120", "EUR", "EUR"],
  ])("chooses a consistent unit for base %s %s", (base, currency, unit) => {
    expect(calendarPriceUnit(base, currency)).toBe(unit);
  });

  it("uses one unit for normal, holiday and discounted nights in both languages", () => {
    expect(formatCalendarPrice("26000000", "20000000", "IRR", "fa")).toBe("۲٫۶");
    expect(formatCalendarPrice("40000000", "20000000", "IRR", "en")).toBe("4");
    expect(formatCalendarPrice("200000", "20000000", "IRR", "fa")).toBe("۰٫۰۲");
    expect(formatCalendarPrice("6500000", "5000000", "IRR", "en")).toBe("650");
    expect(formatCalendarPrice("5.55", "100", "IRR", "en")).toBe("0.555");
  });

  it("never presents a small positive price as a free night", () => {
    expect(formatCalendarPrice("0.01", "20000000", "IRR", "en")).toBe("<0.001");
    expect(formatCalendarPrice("0.01", "50000", "IRR", "fa")).toBe("<۰٫۰۰۱");
    expect(formatCalendarPrice("0.01", "1", "EUR", "en")).toBe("0.01");
    expect(formatCalendarPrice("0", "1", "EUR", "en")).toBe("0");
  });

  it("keeps foreign currencies compact without converting them to toman", () => {
    expect(formatCalendarPrice("120", "120", "EUR", "en")).toBe("120");
    expect(formatCalendarPrice("1234567.89", "120", "USD", "en")).toBe("1.23m");
    expect(formatCalendarPrice("1500", "120", "SEK", "fa")).toContain("۱٫۵");
  });
});
