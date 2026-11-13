import { percentInput, pricingDefaults, pricingIssue } from "./pricing";

it("accepts Persian percentages and rejects invalid numbers and ambiguous date rules", () => {
  expect(percentInput("−۲۰٫۵")).toBe("-20.5");
  expect(percentInput("۳۰")).toBe("30");
  const p = pricingDefaults();
  expect(pricingIssue(p)).toBeUndefined();
  expect(pricingIssue({ ...p, weekend_enabled: true, weekend_days: [] })).toBe("chooseWeekdays");
  expect(pricingIssue({ ...p, weekend_percent: "-100" })).toBe("invalidPercent");
  const r = {
    id: "one",
    name: "Offer",
    start: "2027-01-01",
    end: "2027-01-03",
    percent: "-20",
    enabled: true,
  };
  expect(pricingIssue({ ...p, ranges: [r, { ...r, id: "two", start: "2027-01-03" }] })).toBe("overlap");
  expect(pricingIssue({ ...p, ranges: [r, { ...r, id: "two", enabled: false }] })).toBeUndefined();
});
