/**
 * A listing's status as the host sees it (specs/008-host-pages, FR-008, data-model "Listing status"), worked
 * out from the review state and whether it is active; nothing is stored. A listing needs at least 3 photos
 * (owner decision Q1, 2026-11-10); the rule lives in the site only, so one with fewer is marked separately.
 */
export type HostStatus = "pending" | "rejected" | "active" | "inactive";

export const MIN_PHOTOS = 3;

type Listing = { is_active: boolean; photos: unknown[]; review?: { status: string } | null };

export function statusOf(listing: Listing): HostStatus {
  const review = listing.review?.status ?? "approved";
  if (review === "pending") return "pending";
  if (review === "rejected") return "rejected";
  return listing.is_active ? "active" : "inactive";
}

export function hasFewPhotos(listing: Listing): boolean {
  return listing.photos.length < MIN_PHOTOS;
}
