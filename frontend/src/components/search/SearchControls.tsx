"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { type SearchState, toQuery } from "@/lib/searchParams";
import { FiltersPanel } from "./FiltersPanel";
import { ResultsMap, type MapPin } from "./ResultsMap";

/** Sorting, amenity filters and the map: the parts of the search page that need the browser. */
export function SearchControls({ state, pins }: { state: SearchState; pins: MapPin[] }) {
  const t = useTranslations("search");
  const router = useRouter();
  const go = (next: SearchState) => router.push(`/search?${toQuery(next).toString()}`);
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <FiltersPanel state={state} onApply={(amenity_ids) => go({ ...state, amenity_ids, offset: 0 })} />
        {state.lat !== undefined ? (
          <label className="flex items-center gap-2 text-sm">
            {t("sort")}
            <select
              className="h-11 rounded-lg border bg-card px-2"
              value={state.sort}
              onChange={(event) =>
                go({ ...state, sort: event.target.value as SearchState["sort"], offset: 0 })
              }
            >
              <option value="rating">{t("sortRating")}</option>
              <option value="distance">{t("sortDistance")}</option>
            </select>
          </label>
        ) : null}
      </div>
      <ResultsMap
        pins={pins}
        onSearchArea={(area) => go({ ...state, city_id: undefined, ...area, sort: state.sort, offset: 0 })}
      />
    </div>
  );
}
