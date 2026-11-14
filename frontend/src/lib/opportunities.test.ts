import { opportunityBudget, opportunityStay } from "./opportunities";

describe("travel opportunity money and booking hand-off", () => {
  it("accepts Persian/Arabic digits and converts toman exactly", () => {
    expect(opportunityBudget("۱۰٬۰۰۰٬۰۰۰", "IRR")).toBe("100000000");
    expect(opportunityBudget("١٢٫٣٤", "IRR")).toBe("123.4");
    expect(opportunityBudget("999999999999.99", "EUR")).toBe("999999999999.99");
    expect(opportunityBudget("200000000", "IRR")).toBe("2000000000");
  });
  it.each(["", "0", "-1", "1.001", "NaN", "1e9", "1000000000000", "9".repeat(41)])(
    "rejects invalid or excessive budget %s",
    (value) => {
      expect(opportunityBudget(value, "EUR")).toBeNull();
    },
  );
  it("enforces the total limit after conversion", () => {
    expect(opportunityBudget("100000000000", "IRR")).toBeNull();
  });
  it("preserves every guest count and exact dates", () => {
    const stay = new URLSearchParams(
      opportunityStay("2027-01-01", "2027-01-04", { adults: 3, children: 1, infants: 2, pets: 1 }),
    );
    expect(Object.fromEntries(stay)).toEqual({
      check_in: "2027-01-01",
      check_out: "2027-01-04",
      adults: "3",
      children: "1",
      infants: "2",
      pets: "1",
    });
    expect(new URLSearchParams(opportunityStay("2027-01-01", "2027-01-02", {})).get("adults")).toBe("2");
  });
});
