import type { components } from "@/api/schema";
import { parseAmountInput } from "./money";

export type PricingPolicy = Required<components["schemas"]["PricingPolicy-Output"]>;
export type PriceQuote = components["schemas"]["PriceQuote"];
export type NightlyPrice = components["schemas"]["NightlyPrice"];
export function pricingDefaults(
  value?: components["schemas"]["PricingPolicy-Input"] | null,
  country = "IR",
): PricingPolicy {
  return {
    weekend_enabled: value?.weekend_enabled ?? false,
    weekend_days: value?.weekend_days ?? (country === "IR" ? [3, 4] : [5, 6]),
    weekend_percent: String(value?.weekend_percent ?? 30),
    holiday_enabled: value?.holiday_enabled ?? false,
    holiday_percent: String(value?.holiday_percent ?? 100),
    ranges: (value?.ranges ?? []).map((r) => ({ ...r, percent: String(r.percent) })),
  };
}
export function percentInput(text: string): string {
  const negative = /^[-−]/.test(text.trim());
  const digits = text.trim().replace(/^[-−+]/, "");
  const amount = parseAmountInput(digits);
  return amount === null ? text : `${negative ? "-" : ""}${amount}`;
}
export function pricingIssue(
  policy: PricingPolicy,
): "invalidPercent" | "invalidRange" | "overlap" | "chooseWeekdays" | undefined {
  if (
    [policy.weekend_percent, policy.holiday_percent, ...policy.ranges.map((r) => r.percent)].some(
      (p) => !/^-?\d+(\.\d{1,2})?$/.test(p) || Number(p) < -99 || Number(p) > 1000,
    )
  )
    return "invalidPercent";
  if (policy.weekend_enabled && !policy.weekend_days.length) return "chooseWeekdays";
  if (policy.ranges.some((r) => !r.name.trim() || !r.start || !r.end || r.end < r.start))
    return "invalidRange";
  const ranges = policy.ranges.filter((r) => r.enabled).sort((a, b) => a.start.localeCompare(b.start));
  if (ranges.some((r, i) => i > 0 && ranges[i - 1]!.end >= r.start)) return "overlap";
}
