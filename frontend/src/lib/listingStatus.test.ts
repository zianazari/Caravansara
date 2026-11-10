import { MIN_PHOTOS, hasFewPhotos, statusOf } from "./listingStatus";

const listing = (status: "pending" | "approved" | "rejected", is_active = true, photos = 3) => ({
  is_active,
  photos: Array.from({ length: photos }, (_, i) => ({ id: i })),
  review: {
    status,
    rejection_reason: status === "rejected" ? "Photos are blurry" : null,
    submitted_at: null,
  },
});

describe("listing status (data-model)", () => {
  it.each([
    ["pending", true, "pending"],
    ["pending", false, "pending"],
    ["rejected", true, "rejected"],
    ["approved", true, "active"],
    ["approved", false, "inactive"],
  ] as const)("review %s and active %s is %s", (review, active, status) => {
    expect(statusOf(listing(review, active))).toBe(status);
  });

  it("marks a listing with fewer than 3 photos, whatever its status (Q1)", () => {
    expect(MIN_PHOTOS).toBe(3);
    for (const n of [0, 1, 2]) expect(hasFewPhotos(listing("approved", true, n))).toBe(true);
    expect(hasFewPhotos(listing("approved", true, 3))).toBe(false);
  });
});
