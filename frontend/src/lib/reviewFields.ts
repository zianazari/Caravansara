/**
 * Which changes send an approved listing back to review, so the host is warned before saving (specs/008-host-
 * pages, FR-010, research R8). The list is the rule of feature 004 (specs/backend (004), FR-009 and FR-010),
 * kept here in one place; the API applies the same rule and stays the final word. A change that leaves the
 * value as it was is not a change (004 FR-009).
 */
export const REVIEW_FIELDS = [
  "title",
  "description",
  "city_id",
  "neighborhood",
  "address",
  "latitude",
  "longitude",
  "property_type",
  "amenity_ids",
] as const;

export const NO_REVIEW_FIELDS = [
  "price_per_night",
  "cleaning_fee",
  "currency",
  "is_active",
  "check_in_time",
  "check_out_time",
  "max_guests",
  "bedrooms",
  "beds",
  "bathrooms",
  "pets_allowed",
  "max_pets",
] as const;

/** Photo changes: adding one or changing its label needs review; reordering, the cover and removal do not. */
export type PhotoChange = "photo_added" | "photo_labelled" | "photo_reordered" | "photo_removed";

type Values = Record<string, unknown>;

function normal(value: unknown): unknown {
  if (Array.isArray(value)) return [...value].map(String).sort().join(",");
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  return String(value);
}

export function needsReview(
  reviewStatus: string,
  before: Values,
  after: Values,
  photoChange?: PhotoChange,
): boolean {
  if (reviewStatus !== "approved") return false; // pending and rejected listings are not public anyway
  if (photoChange) return photoChange === "photo_added" || photoChange === "photo_labelled";
  return REVIEW_FIELDS.some((field) => field in after && normal(before[field]) !== normal(after[field]));
}
