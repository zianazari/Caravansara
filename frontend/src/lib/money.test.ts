import { add, formatMoney, multiply, rialToToman, toHundredths } from "./money";

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
});
