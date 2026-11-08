/**
 * The booking being prepared (research R13; data-model, "Booking draft"): listing, dates, guests and one
 * idempotency key. It is kept in sessionStorage so it survives the trip through the login page and a retry,
 * but only in this tab and only until the tab closes. It holds no secret: no token ever goes here (FR-012).
 *
 * The key stays the same while the choices stay the same, so pressing "book" twice, or sending again after a
 * dropped connection, cannot make two holds (FR-025): the API answers the same key with the same booking.
 * Any change to the choices makes a new key.
 */
export type Stay = {
  listing_id: number;
  check_in: string;
  check_out: string;
  adults: number;
  children: number;
  infants: number;
  pets: number;
};
export type Draft = Stay & { idempotency_key: string; booking_id?: number };

const KEY = "cv-booking-draft";

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null; // storage switched off in this browser
  }
}

const sameStay = (a: Stay, b: Stay) =>
  (["listing_id", "check_in", "check_out", "adults", "children", "infants", "pets"] as const).every(
    (k) => a[k] === b[k],
  );

export function readDraft(): Draft | null {
  try {
    const text = storage()?.getItem(KEY);
    return text ? (JSON.parse(text) as Draft) : null;
  } catch {
    return null;
  }
}

function write(draft: Draft): void {
  try {
    storage()?.setItem(KEY, JSON.stringify(draft));
  } catch {
    // Without storage the draft lives only on this page; the API still stops double holds by the key.
  }
}

/** The draft for these choices: the same one (same key) if nothing changed, otherwise a new one. */
export function draftFor(stay: Stay): Draft {
  const current = readDraft();
  if (current && sameStay(current, stay)) return current;
  const draft: Draft = { ...stay, idempotency_key: crypto.randomUUID() };
  write(draft);
  return draft;
}

export function rememberBooking(bookingId: number): void {
  const current = readDraft();
  if (current) write({ ...current, booking_id: bookingId });
}

/** After payment or cancellation, or to start a new booking for the same stay ("book again"). */
export function clearDraft(): void {
  try {
    storage()?.removeItem(KEY);
  } catch {
    // nothing to clear
  }
}
