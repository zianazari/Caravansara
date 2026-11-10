"use client";

import { useSearchParams } from "next/navigation";
import { activeCategory, filterOf } from "@/lib/categories";
import { CategoryBar, useAmenityGroups } from "./CategoryBar";
import { CityRow } from "./CityRow";

/** The cities of the demo data, as in 005: one row of top-rated places each (specs/007-caravansara-theme, FR-013). */
export const SUGGESTED = ["Tehran", "Isfahan", "Shiraz", "London", "Amsterdam", "Stockholm"] as const;

/**
 * The categories and, under them, the city rows. Choosing a category reloads every row with that filter and
 * carries it to "show all" (research R6).
 */
export function HomeRows() {
  const groups = useAmenityGroups().data ?? undefined;
  const category = activeCategory(useSearchParams().get("category"), groups);
  const filter = filterOf(category, groups);
  return (
    <div className="grid min-w-0 gap-8">
      <CategoryBar mode="home" />
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
