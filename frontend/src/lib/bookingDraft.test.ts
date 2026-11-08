import { vi } from "vitest";
import { clearDraft, draftFor, readDraft, rememberBooking } from "./bookingDraft";

const stay = {
  listing_id: 5,
  check_in: "2026-12-01",
  check_out: "2026-12-04",
  adults: 2,
  children: 0,
  infants: 0,
  pets: 0,
};

describe("booking draft (research R13)", () => {
  beforeEach(() => window.sessionStorage.clear());

  it("keeps the same idempotency key while the choices stay the same (FR-025)", () => {
    const first = draftFor(stay);
    expect(first.idempotency_key).toMatch(/^[0-9a-f-]{36}$/);
    expect(draftFor({ ...stay }).idempotency_key).toBe(first.idempotency_key);
  });

  it("makes a new key when any choice changes", () => {
    const first = draftFor(stay);
    expect(draftFor({ ...stay, adults: 3 }).idempotency_key).not.toBe(first.idempotency_key);
    expect(draftFor({ ...stay, check_out: "2026-12-05" }).idempotency_key).not.toBe(first.idempotency_key);
  });

  it("survives a page change in the same tab, remembers the hold, and is cleared afterwards", () => {
    const first = draftFor(stay);
    rememberBooking(42);
    expect(readDraft()).toEqual({ ...first, booking_id: 42 });
    clearDraft();
    expect(readDraft()).toBeNull();
    rememberBooking(1); // nothing to remember
    expect(readDraft()).toBeNull();
  });

  it("holds no token, only the stay and the key", () => {
    draftFor(stay);
    const saved = JSON.parse(window.sessionStorage.getItem("cv-booking-draft")!);
    expect(Object.keys(saved).sort()).toEqual([...Object.keys(stay), "idempotency_key"].sort());
  });

  it("works when the browser blocks storage", () => {
    const spy = vi.spyOn(window, "sessionStorage", "get").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(draftFor(stay).idempotency_key).toBeTruthy();
    expect(readDraft()).toBeNull();
    clearDraft();
    spy.mockRestore();
  });

  it("ignores a broken saved draft", () => {
    window.sessionStorage.setItem("cv-booking-draft", "{not json");
    expect(readDraft()).toBeNull();
  });
});
