import { badgeOf } from "./badge";

describe("badgeOf (specs/007-caravansara-theme, FR-006)", () => {
  it.each([
    ["4.80", 3, "guest_favourite"],
    ["5.00", 120, "guest_favourite"],
    ["4.79", 10, null],
    ["5.00", 2, null],
    [null, 0, "new"],
    ["0", 0, "new"],
    ["4.20", 7, null],
  ] as const)("rating %s with %i reviews gives %s", (avg_rating, review_count, badge) => {
    expect(badgeOf({ avg_rating, review_count })).toBe(badge);
  });
});
