import {
  formatPinPrice,
  add,
  formatMoney,
  multiply,
  parseAmountInput,
  rialToToman,
  toHundredths,
  tomanToRial,
} from "./money";

describe("money", () => {
  it("reads decimal strings exactly", () => {
    expect(toHundredths("123.45")).toBe(12345n);
    expect(toHundredths("7")).toBe(700n);
    expect(toHundredths("0.5")).toBe(50n);
    expect(toHundredths("-1.20")).toBe(-120n);
    expect(() => toHundredths("1,000")).toThrow(RangeError);
  });

  it("turns rial into toman without losing a digit, even for the largest total", () => {
    expect(rialToToman("50000000.00")).toBe("5000000");
    expect(rialToToman("366000000000.00")).toBe("36600000000");
    expect(rialToToman("999999999999.99")).toBe("99999999999.999");
    expect(rialToToman("5.00")).toBe("0.5");
  });

  it("shows rial as toman, in Persian and in English", () => {
    expect(formatMoney("123456789.00", "IRR", "fa", "تومان")).toBe("۱۲٬۳۴۵٬۶۷۸٫۹ تومان");
    expect(formatMoney("50000000.00", "IRR", "fa", "تومان")).toBe("۵٬۰۰۰٬۰۰۰ تومان");
    expect(formatMoney("123456789.00", "IRR", "en", "Toman")).toBe("12,345,678.9 Toman");
    expect(formatMoney("366000000000.00", "IRR", "en", "Toman")).toBe("36,600,000,000 Toman");
  });

  it("shows other currencies with their own symbol and decimals", () => {
    expect(formatMoney("120.00", "EUR", "en", "Toman")).toBe("€120.00");
    expect(formatMoney("120.00", "EUR", "fa", "تومان")).toContain("۱۲۰٫۰۰");
    expect(formatMoney("99.50", "USD", "en", "Toman")).toBe("US$99.50");
    expect(formatMoney("1500.00", "SEK", "en", "Toman")).toContain("1,500.00");
    for (const currency of ["GBP", "DKK"]) {
      expect(formatMoney("10.00", currency, "fa", "تومان")).toMatch(/۱۰٫۰۰/);
    }
  });

  it("adds and multiplies exactly", () => {
    expect(multiply("0.10", 3)).toBe("0.3");
    expect(add(multiply("1000000000.00", 365), "1000000000.00")).toBe("366000000000");
    expect(add("0.10", "0.20")).toBe("0.3");
  });

  // specs/008-host-pages, research R7: a host types toman; the API stores rial.
  it("reads what a host types, with Persian digits and separators", () => {
    expect(parseAmountInput("۲٬۵۰۰٬۰۰۰")).toBe("2500000");
    expect(parseAmountInput("2,500,000.5")).toBe("2500000.5");
    expect(parseAmountInput(" ۱۲۰٫۵ ")).toBe("120.5");
    expect(parseAmountInput("")).toBeNull();
    expect(parseAmountInput("12a")).toBeNull();
    expect(parseAmountInput("1.234")).toBeNull(); // more than two decimals
  });

  it("turns toman into rial exactly, and keeps to the API's limit", () => {
    expect(tomanToRial("2500000")).toBe("25000000.00");
    expect(tomanToRial("2500000.5")).toBe("25000005.00");
    expect(tomanToRial("0.05")).toBe("0.50");
    expect(tomanToRial("100000000")).toBe("1000000000.00");
    expect(tomanToRial("100000000.01")).toBeNull(); // over 1,000,000,000 rial
  });
});

describe("formatPinPrice (feature 048)", () => {
  const fa = {
    thousand: (n: string) => `${n} هزار تومان`,
    million: (n: string) => `${n} میلیون تومان`,
    toman: "تومان",
  };
  const en = {
    thousand: (n: string) => `${n}k toman`,
    million: (n: string) => `${n}M toman`,
    toman: "toman",
  };

  it("shows rial as thousands or millions of toman, in Persian digits", () => {
    expect(formatPinPrice("45000000.00", "IRR", "fa", fa)).toBe("۴٫۵ میلیون تومان"); // 4,500,000 toman
    expect(formatPinPrice("60000000.00", "IRR", "fa", fa)).toBe("۶ میلیون تومان");
    expect(formatPinPrice("4500000.00", "IRR", "fa", fa)).toBe("۴۵۰ هزار تومان");
    expect(formatPinPrice("5000.00", "IRR", "fa", fa)).toBe("۵۰۰ تومان");
    expect(formatPinPrice("45000000.00", "IRR", "en", en)).toBe("4.5M toman");
  });

  it("rounds other currencies to whole units", () => {
    expect(formatPinPrice("191.00", "EUR", "en", en)).toBe("€191");
    expect(formatPinPrice("190.60", "EUR", "en", en)).toBe("€191");
  });
});
