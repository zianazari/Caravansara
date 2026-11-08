import { parseIntInput, toLatinDigits } from "./digits";

describe("digits", () => {
  it("turns Persian and Arabic digits into Latin ones", () => {
    expect(toLatinDigits("۰۱۲۳۴۵۶۷۸۹")).toBe("0123456789");
    expect(toLatinDigits("٠١٢٣٤٥٦٧٨٩")).toBe("0123456789");
    expect(toLatinDigits("۲ adults, ٣ kids, 4")).toBe("2 adults, 3 kids, 4");
  });

  it("reads whole numbers in any digit set", () => {
    expect(parseIntInput("۱۲")).toBe(12);
    expect(parseIntInput(" ٧ ")).toBe(7);
    expect(parseIntInput("-3")).toBe(-3);
    expect(parseIntInput("1.5")).toBeNull();
    expect(parseIntInput("")).toBeNull();
    expect(parseIntInput("abc")).toBeNull();
    expect(parseIntInput("99999999999999999999")).toBeNull();
  });
});
