"use client";

import { useSearchParams } from "next/navigation";
import { FiltersPanel } from "@/components/search/FiltersPanel";
import { usePathname, useRouter } from "@/i18n/navigation";
import { activeCategory, filterOf } from "@/lib/categories";
import { parseSearch } from "@/lib/searchParams";
import { CategoryBar, useAmenityGroups } from "./CategoryBar";
import { CityRow } from "./CityRow";

/** The cities of the demo data, as in 005: one row of top-rated places each (specs/007-caravansara-theme, FR-013). */
export const SUGGESTED = ["Tehran", "Isfahan", "Shiraz", "London", "Amsterdam", "Stockholm"] as const;

/**
 * The categories and, under them, the city rows. Choosing a category reloads every row with that filter and
 * carries it to "show all" (research R6).
 *
 * Feature 033: the filters button at the end of the category row adds amenities (?amenity_ids=) on top of the
 * category; every row then shows only places with all of them, and "show all" carries them to the search.
 */
export function HomeRows() {
  const groups = useAmenityGroups().data ?? undefined;
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const category = activeCategory(params.get("category"), groups);
  const chosen = params.getAll("amenity_ids").map(Number).filter(Number.isInteger);
  const base = filterOf(category, groups);
  const amenityIds = [...new Set([...(base.amenity_ids ?? []), ...chosen])].sort((a, b) => a - b);
  const filter = { ...base, ...(amenityIds.length ? { amenity_ids: amenityIds } : {}) };

  function applyAmenities(ids: number[]) {
    const next = new URLSearchParams(params.toString());
    next.delete("amenity_ids");
    for (const id of ids) next.append("amenity_ids", String(id));
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <div className="grid min-w-0 gap-8">
      <CategoryBar
        mode="home"
        filters={
          <FiltersPanel state={parseSearch({ amenity_ids: chosen.map(String) })} onApply={applyAmenities} />
        }
      />
      <div className="flex min-w-0 flex-col">
        {SUGGESTED.map((city) => (
          <CityRow
            key={city}
            city={city}
            category={category === "all" ? undefined : category}
            filter={filter}
          />
        ))}
      </div>
    </div>
  );
}
