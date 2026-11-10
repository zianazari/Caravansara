import type { components } from "@/api/schema";

/**
 * The listing being made in the step-by-step form (specs/008-host-pages, research R2; data-model, "Listing
 * draft"). It is kept in sessionStorage, like the booking draft of 005, so reloading a step or going back
 * keeps the answers, but only in this tab and only until the tab closes. It holds no secret. The photo files
 * are not in it: three 10 MB pictures do not fit in browser storage, so after closing the tab they are
 * chosen again. Nothing reaches the server until the last step (research R3).
 */
export type ListingDraft = Partial<
  Omit<components["schemas"]["ListingCreate"], "price_per_night" | "cleaning_fee" | "bathrooms"> & {
    price_per_night: string;
    cleaning_fee: string;
    bathrooms: number;
    /** The chosen city's name and country code, to show it again and to pick its currency (research R7). */
    city_label: string;
    country_code: string;
    /**
     * The listing once POST /listings has made it. If a photo then fails and the page is reloaded, sending
     * again only adds photos to it, instead of making a second listing (research R3).
     */
    listing_id: number;
  }
>;

const KEY = "cv-listing-draft";
let inMemory: ListingDraft = {};

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null; // storage switched off in this browser: the draft lives on this page only
  }
}

export function readListingDraft(): ListingDraft {
  const store = storage();
  if (!store) return { ...inMemory };
  try {
    const value: unknown = JSON.parse(store.getItem(KEY) ?? "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? (value as ListingDraft) : {};
  } catch {
    return {};
  }
}

export function saveListingDraft(changes: ListingDraft): ListingDraft {
  const next = { ...readListingDraft(), ...changes };
  inMemory = next;
  try {
    storage()?.setItem(KEY, JSON.stringify(next));
  } catch {
    // full or blocked: the copy in memory still serves this page
  }
  return next;
}

export function clearListingDraft(): void {
  inMemory = {};
  try {
    storage()?.removeItem(KEY);
  } catch {
    // nothing to clear
  }
}
