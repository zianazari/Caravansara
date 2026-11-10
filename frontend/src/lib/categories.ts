import type { components } from "@/api/schema";

type AmenityGroup = components["schemas"]["AmenityCategoryOut"];

/**
 * The category row (specs/007-caravansara-theme, FR-014, answer Q2): a quick way in, built from filters the
 * search already has, so the API does not change. Each category is one amenity (amenity_ids) or pets.
 *
 * There are no categories by place type (entire place, private room, shared room): GET /search/listings has
 * no filter for it, and filtering in the browser would break the paging and the total (research R5). That
 * filter, and new categories such as "traditional house", are later work in docs/future-work.md.
 */
export type CategoryKey =
  "all" | "pets" | "hot_tub" | "sauna" | "lake_access" | "balcony" | "free_parking" | "workspace" | "kitchen";

export type Category = { key: CategoryKey; amenity?: string; icon: string };
export type CategoryFilter = { amenity_ids?: number[]; pets?: number };

/** In display order. `amenity` is the English name in GET /amenities; `icon` a lucide-react name. */
export const CATEGORIES: readonly Category[] = [
  { key: "all", icon: "LayoutGrid" },
  { key: "pets", icon: "PawPrint" },
  { key: "hot_tub", amenity: "Hot tub", icon: "Bath" },
  { key: "sauna", amenity: "Sauna", icon: "Flame" },
  { key: "lake_access", amenity: "Lake access", icon: "Waves" },
  { key: "balcony", amenity: "Balcony", icon: "Fence" },
  { key: "free_parking", amenity: "Free parking", icon: "CircleParking" },
  { key: "workspace", amenity: "Dedicated workspace", icon: "Laptop" },
  { key: "kitchen", amenity: "Kitchen", icon: "CookingPot" },
];

function amenityId(name: string, groups: AmenityGroup[] | undefined): number | undefined {
  for (const group of groups ?? []) {
    const found = group.amenities.find((a) => a.name === name);
    if (found) return found.id;
  }
  return undefined;
}

/** The categories to show: all and pets always; an amenity's category only if the amenity list has it. */
export function categoriesFor(groups: AmenityGroup[] | undefined): Category[] {
  return CATEGORIES.filter((c) => !c.amenity || amenityId(c.amenity, groups) !== undefined);
}

/** The search filters for a category. */
export function filterOf(key: CategoryKey, groups: AmenityGroup[] | undefined): CategoryFilter {
  if (key === "pets") return { pets: 1 };
  const category = CATEGORIES.find((c) => c.key === key);
  const id = category?.amenity ? amenityId(category.amenity, groups) : undefined;
  return id === undefined ? {} : { amenity_ids: [id] };
}

/** The category in the address (?category=), or all when it is missing, unknown or not offered. */
export function activeCategory(
  value: string | null | undefined,
  groups: AmenityGroup[] | undefined,
): CategoryKey {
  const offered = categoriesFor(groups);
  return offered.find((c) => c.key === value)?.key ?? "all";
}
