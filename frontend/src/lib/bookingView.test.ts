import {
  cancelDeadline,
  canCancel,
  canPay,
  canReview,
  group,
  preCheck,
  priceBreakdown,
  remainingMs,
} from "./bookingView";

const tehran = {
  id: 1,
  title: "",
  city: "Tehran",
  country_code: "IR",
  timezone: "Asia/Tehran",
  cover_url: null,
};
const newYork = { ...tehran, city: "New York City", timezone: "America/New_York" };

describe("booking rules", () => {
  it("counts the hold down with the server's clock (FR-026, research R12)", () => {
    const hold = { status: "pending" as const, hold_expires_at: "2026-11-08T12:15:00Z" };
    const now = Date.parse("2026-11-08T12:00:00Z");
    expect(remainingMs(hold, now, 0)).toBe(15 * 60_000);
    expect(remainingMs(hold, now, 60_000)).toBe(14 * 60_000); // the server is a minute ahead
    expect(canPay(hold, now + 15 * 60_000, 0)).toBe(false);
    expect(remainingMs({ status: "confirmed", hold_expires_at: null }, now, 0)).toBe(0);
  });

  it("offers cancelling only before the check-in day in the listing's city (FR-030)", () => {
    const booking = { status: "confirmed" as const, check_in: "2026-12-10", listing: tehran };
    // 20:29 UTC on 9 Dec is 23:59 in Tehran: still the day before
    expect(canCancel(booking, new Date("2026-12-09T20:29:00Z"))).toBe(true);
    // 20:30 UTC is midnight in Tehran: the check-in day has begun
    expect(canCancel(booking, new Date("2026-12-09T20:30:00Z"))).toBe(false);
    // the same instant is still 9 Dec afternoon in New York
    expect(canCancel({ ...booking, listing: newYork }, new Date("2026-12-09T20:30:00Z"))).toBe(true);
    expect(canCancel({ ...booking, status: "cancelled" }, new Date("2026-12-01T00:00:00Z"))).toBe(false);
    expect(cancelDeadline(booking).toISOString()).toBe("2026-12-09T20:29:59.999Z");
  });

  it("offers a review until 14 days after check-out in the city (FR-031)", () => {
    const stay = { status: "completed" as const, check_out: "2026-11-01", listing: tehran };
    expect(canReview(stay, new Date("2026-11-15T12:00:00Z"))).toBe(true); // day 14
    expect(canReview(stay, new Date("2026-11-15T20:31:00Z"))).toBe(false); // 16 Nov in Tehran: day 15
    // feature 015: a stay that already has a review is not offered the form again
    expect(canReview({ ...stay, has_review: true }, new Date("2026-11-15T12:00:00Z"))).toBe(false);
    expect(canReview({ ...stay, status: "confirmed" }, new Date("2026-11-02T00:00:00Z"))).toBe(false);
  });

  it("puts live trips that have not ended under upcoming", () => {
    const now = new Date("2026-11-08T12:00:00Z");
    expect(group({ status: "confirmed", check_out: "2026-11-08", listing: tehran }, now)).toBe("upcoming");
    expect(group({ status: "pending", check_out: "2026-12-01", listing: tehran }, now)).toBe("upcoming");
    expect(group({ status: "confirmed", check_out: "2026-11-07", listing: tehran }, now)).toBe("past");
    expect(group({ status: "cancelled", check_out: "2026-12-01", listing: tehran }, now)).toBe("past");
  });

  it("adds up the price exactly as the API does (FR-023)", () => {
    expect(priceBreakdown("50000000.00", "5000000.00", "2026-12-01", "2026-12-04")).toEqual({
      nights: 3,
      stay: "150000000",
      cleaningFee: "5000000.00",
      total: "155000000",
    });
    expect(priceBreakdown("0.10", "0.20", "2026-12-01", "2026-12-04").total).toBe("0.5");
  });

  it("checks what can be checked before asking the API (FR-024)", () => {
    const listing = { max_guests: 3, pets_allowed: false, max_pets: 0, timezone: "Asia/Tehran" };
    const now = new Date("2026-11-08T12:00:00Z");
    const stay = { check_in: "2026-12-01", check_out: "2026-12-04", adults: 2, children: 1, pets: 0 };
    expect(preCheck(listing, stay, now)).toBeNull();
    expect(preCheck(listing, { ...stay, children: 2 }, now)).toBe("capacity");
    expect(preCheck(listing, { ...stay, pets: 1 }, now)).toBe("pets");
    expect(preCheck({ ...listing, pets_allowed: true, max_pets: 1 }, { ...stay, pets: 2 }, now)).toBe("pets");
    expect(preCheck(listing, { ...stay, check_out: "2026-12-01" }, now)).toBe("order");
    expect(preCheck(listing, { ...stay, check_in: "2026-11-07" }, now)).toBe("past");
    expect(preCheck(listing, { ...stay, check_out: "2027-12-05" }, now)).toBe("too_long");
    expect(preCheck(listing, { ...stay, check_in: "2027-11-10", check_out: "2027-11-12" }, now)).toBe(
      "too_far",
    );
  });
});
