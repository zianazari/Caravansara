import { addDays } from "./calendar";

/**
 * The calendar's rules for taken nights (feature 019). A night is taken when the listing is booked from that
 * date to the next. A guest may arrive on a free night and leave on any later date up to and including the
 * first taken night: leaving that morning is fine, staying that night is not. Dates are YYYY-MM-DD.
 */
export type Booked = ReadonlySet<string>;

/** Arrival is possible on a free night that is not in the past. */
export function canCheckIn(iso: string, booked: Booked, today: string): boolean {
  return iso >= today && !booked.has(iso);
}

/** The first taken night after an arrival, or undefined when every later night is free. */
export function firstTakenAfter(checkIn: string, booked: Booked): string | undefined {
  let first: string | undefined;
  for (const night of booked) if (night > checkIn && (first === undefined || night < first)) first = night;
  return first;
}

/** Leaving is possible after the arrival and no later than the first taken night. */
export function canCheckOut(checkIn: string, iso: string, booked: Booked): boolean {
  if (iso <= checkIn) return false;
  const limit = firstTakenAfter(checkIn, booked);
  return limit === undefined || iso <= limit;
}

/** Whether every night of a stay is free (for dates that came from the address or a search). */
export function stayIsFree(checkIn: string, checkOut: string, booked: Booked): boolean {
  for (let night = checkIn; night < checkOut; night = addDays(night, 1)) if (booked.has(night)) return false;
  return true;
}
