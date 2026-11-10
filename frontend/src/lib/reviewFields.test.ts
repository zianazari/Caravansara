import { NO_REVIEW_FIELDS, REVIEW_FIELDS, needsReview } from "./reviewFields";

/**
 * The rule of feature 004 (specs/backend (004), FR-009 and FR-010), one test per field (SC-003): which changes
 * send an approved listing back to review, and which do not.
 */
const listing = {
  title: "Garden flat",
  description: "Quiet.",
  city_id: 7,
  neighborhood: "Tajrish",
  address: "Valiasr 1",
  latitude: 35.8,
  longitude: 51.43,
  property_type: "entire_place",
  amenity_ids: [1, 2],
  price_per_night: "50000000.00",
  cleaning_fee: "0.00",
  currency: "IRR",
  is_active: true,
  check_in_time: "14:00",
  check_out_time: "11:00",
  max_guests: 4,
  bedrooms: 2,
  beds: 2,
  bathrooms: "1.0",
  pets_allowed: false,
  max_pets: 0,
};
const changed: Record<string, unknown> = {
  title: "Garden house",
  description: "Very quiet.",
  city_id: 8,
  neighborhood: "Niavaran",
  address: "Valiasr 2",
  latitude: 35.81,
  longitude: 51.44,
  property_type: "private_room",
  amenity_ids: [1, 3],
  price_per_night: "60000000.00",
  cleaning_fee: "10000.00",
  currency: "EUR",
  is_active: false,
  check_in_time: "15:00",
  check_out_time: "10:00",
  max_guests: 5,
  bedrooms: 3,
  beds: 3,
  bathrooms: "2.0",
  pets_allowed: true,
  max_pets: 1,
};

describe("needsReview (SC-003)", () => {
  it("covers every field of the listing form, in one list or the other", () => {
    expect([...REVIEW_FIELDS, ...NO_REVIEW_FIELDS].sort()).toEqual(Object.keys(listing).sort());
  });

  it.each(REVIEW_FIELDS)("%s sends an approved listing back to review", (field) => {
    expect(needsReview("approved", listing, { ...listing, [field]: changed[field] })).toBe(true);
  });

  it.each(NO_REVIEW_FIELDS)("%s does not", (field) => {
    expect(needsReview("approved", listing, { ...listing, [field]: changed[field] })).toBe(false);
  });

  it("only matters for an approved listing: pending and rejected ones are not public anyway", () => {
    expect(needsReview("pending", listing, { ...listing, title: "New" })).toBe(false);
    expect(needsReview("rejected", listing, { ...listing, title: "New" })).toBe(false);
  });

  it("does not count a value that did not really change", () => {
    expect(needsReview("approved", listing, { ...listing, title: "  Garden flat " })).toBe(false);
    expect(needsReview("approved", listing, { ...listing, amenity_ids: [2, 1] })).toBe(false);
    expect(needsReview("approved", listing, { ...listing, neighborhood: "", description: "Quiet." })).toBe(
      true,
    );
    expect(
      needsReview("approved", { ...listing, neighborhood: null }, { ...listing, neighborhood: "" }),
    ).toBe(false);
  });

  it("knows the photo changes: a new photo or a new label needs review, order and removal do not", () => {
    expect(needsReview("approved", {}, {}, "photo_added")).toBe(true);
    expect(needsReview("approved", {}, {}, "photo_labelled")).toBe(true);
    expect(needsReview("approved", {}, {}, "photo_reordered")).toBe(false);
    expect(needsReview("approved", {}, {}, "photo_removed")).toBe(false);
  });
});
