import type { components } from "@/api/schema";
import { addDays, daysBetween } from "./calendar";
import { startOfDayInZone, todayInZone } from "./cityTime";
import { add, multiply } from "./money";

/**
 * What the booking pages may offer (data-model, "Booking view"). Each rule mirrors the API's, in the listing
 * city's time zone (research R9), so a button is shown only when the API will accept it. The API stays the
 * final word: a refused request gets its translated message (FR-024).
 */
type Booking = components["schemas"]["BookingOut"];
export const MAX_NIGHTS = 365; // the API's max_nights
export const REVIEW_DAYS = 14; // the API's review_window_days

/** Milliseconds left to pay, using the server's clock: device time plus the measured skew (research R12). */
export function remainingMs(
  booking: Pick<Booking, "status" | "hold_expires_at">,
  now: number,
  skewMs: number,
): number {
  if (booking.status !== "pending" || !booking.hold_expires_at) return 0;
  return Math.max(0, Date.parse(booking.hold_expires_at) - (now + skewMs));
}

export function canPay(
  booking: Pick<Booking, "status" | "hold_expires_at">,
  now: number,
  skewMs: number,
): boolean {
  return remainingMs(booking, now, skewMs) > 0;
}

/** Guests and hosts may cancel a pending or confirmed booking before the check-in day in the city (FR-030). */
export function canCancel(
  booking: Pick<Booking, "status" | "check_in" | "listing">,
  now: Date = new Date(),
): boolean {
  return (
    (booking.status === "pending" || booking.status === "confirmed") &&
    todayInZone(booking.listing.timezone, now) < booking.check_in
  );
}

/** The last moment to cancel: just before the check-in day starts in the listing's city. */
export function cancelDeadline(booking: Pick<Booking, "check_in" | "listing">): Date {
  return new Date(startOfDayInZone(booking.check_in, booking.listing.timezone).getTime() - 1);
}

/** A completed stay can be reviewed until 14 days after check-out, in the city (FR-031). */
export function canReview(
  booking: Pick<Booking, "status" | "check_out" | "listing">,
  now: Date = new Date(),
): boolean {
  return (
    booking.status === "completed" &&
    todayInZone(booking.listing.timezone, now) <= addDays(booking.check_out, REVIEW_DAYS)
  );
}

/** Upcoming trips first, then past ones (FR-029). */
export function group(
  booking: Pick<Booking, "status" | "check_out" | "listing">,
  now: Date = new Date(),
): "upcoming" | "past" {
  const live = booking.status === "pending" || booking.status === "confirmed";
  return live && booking.check_out >= todayInZone(booking.listing.timezone, now) ? "upcoming" : "past";
}

/** nights × price + cleaning fee, in exact decimals, as the API counts it (FR-023). */
export function priceBreakdown(
  pricePerNight: string,
  cleaningFee: string,
  checkIn: string,
  checkOut: string,
) {
  const nights = daysBetween(checkIn, checkOut);
  const stay = multiply(pricePerNight, nights);
  return { nights, stay, cleaningFee, total: add(stay, cleaningFee) };
}

export type PreCheckProblem = "capacity" | "pets" | "order" | "past" | "too_long" | "too_far";

/** The rules a page can check before asking the API (FR-024). */
export function preCheck(
  listing: { max_guests: number; pets_allowed: boolean; max_pets: number; timezone: string },
  stay: { check_in: string; check_out: string; adults: number; children: number; pets: number },
  now: Date = new Date(),
): PreCheckProblem | null {
  const today = todayInZone(listing.timezone, now);
  if (stay.adults + stay.children > listing.max_guests) return "capacity";
  if (stay.pets > 0 && (!listing.pets_allowed || stay.pets > listing.max_pets)) return "pets";
  if (stay.check_out <= stay.check_in) return "order";
  if (stay.check_in < today) return "past";
  if (daysBetween(stay.check_in, stay.check_out) > MAX_NIGHTS) return "too_long";
  if (stay.check_in > addDays(today, 365)) return "too_far";
  return null;
}
