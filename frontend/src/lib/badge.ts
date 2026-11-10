/**
 * The badge on a listing card (specs/007-caravansara-theme, FR-006, data-model: Badge), worked out from the
 * card's own rating and review count, so nothing is stored and the API does not change. The thresholds are the
 * spec's default: "guest favourite" from 4.8 with at least 3 reviews, so one glowing review is not enough;
 * "new" for a place nobody has reviewed yet, instead of a rating of zero.
 */
export type Badge = "guest_favourite" | "new";

export const FAVOURITE_RATING = 4.8;
export const FAVOURITE_MIN_REVIEWS = 3;

export function badgeOf(listing: {
  avg_rating?: string | number | null;
  review_count: number;
}): Badge | null {
  if (listing.review_count === 0) return "new";
  const rating = Number(listing.avg_rating ?? 0);
  return listing.review_count >= FAVOURITE_MIN_REVIEWS && rating >= FAVOURITE_RATING
    ? "guest_favourite"
    : null;
}
