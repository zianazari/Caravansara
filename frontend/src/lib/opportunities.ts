import type { paths } from "@/api/schema";
import { multiply, parseAmountInput, toHundredths } from "@/lib/money";

export type OpportunityQuery = NonNullable<
  paths["/api/v1/search/opportunities"]["get"]["parameters"]["query"]
>;

/** A whole-trip budget. IRR is entered in toman; no nightly-price cap applies. */
export function opportunityBudget(input: string, currency: string): string | null {
  if (input.length > 40) return null;
  const parsed = parseAmountInput(input);
  if (!parsed) return null;
  const amount = currency === "IRR" ? multiply(parsed, 10) : parsed;
  const units = toHundredths(amount);
  return units > 0n && units <= 99999999999999n ? amount : null;
}

export function opportunityStay(
  checkIn: string,
  checkOut: string,
  guests: Pick<OpportunityQuery, "adults" | "children" | "infants" | "pets">,
): string {
  return new URLSearchParams({
    check_in: checkIn,
    check_out: checkOut,
    adults: String(guests.adults ?? 2),
    children: String(guests.children ?? 0),
    infants: String(guests.infants ?? 0),
    pets: String(guests.pets ?? 0),
  }).toString();
}
