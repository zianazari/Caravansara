import { canCheckIn, canCheckOut, firstTakenAfter, stayIsFree } from "./availability";

const booked = new Set(["2027-01-10", "2027-01-11", "2027-01-20"]);

describe("availability (feature 019)", () => {
  it("lets a guest arrive only on a free night that has not passed", () => {
    expect(canCheckIn("2027-01-09", booked, "2027-01-01")).toBe(true);
    expect(canCheckIn("2027-01-10", booked, "2027-01-01")).toBe(false);
    expect(canCheckIn("2026-12-31", booked, "2027-01-01")).toBe(false);
  });

  it("lets a guest leave on the morning of the first taken night, not later", () => {
    expect(firstTakenAfter("2027-01-05", booked)).toBe("2027-01-10");
    expect(canCheckOut("2027-01-05", "2027-01-10", booked)).toBe(true);
    expect(canCheckOut("2027-01-05", "2027-01-11", booked)).toBe(false);
    expect(canCheckOut("2027-01-05", "2027-01-05", booked)).toBe(false);
    expect(canCheckOut("2027-01-21", "2027-03-01", booked)).toBe(true); // nothing taken later
  });

  it("checks a whole stay", () => {
    expect(stayIsFree("2027-01-05", "2027-01-10", booked)).toBe(true);
    expect(stayIsFree("2027-01-05", "2027-01-12", booked)).toBe(false);
  });
});
