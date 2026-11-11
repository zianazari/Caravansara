"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRouter } from "@/i18n/navigation";
import { type SearchState, toQuery } from "@/lib/searchParams";
import { FiltersPanel } from "./FiltersPanel";
import { ResultsMap, type MapPin } from "./ResultsMap";

/** Sorting, amenity filters and the map: the parts of the search page that need the browser. */
export function SearchControls({ state, pins }: { state: SearchState; pins: MapPin[] }) {
  const t = useTranslations("search");
  const router = useRouter();
  const sortId = useId();
  const go = (next: SearchState) => router.push(`/search?${toQuery(next).toString()}`);
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <FiltersPanel state={state} onApply={(amenity_ids) => go({ ...state, amenity_ids, offset: 0 })} />
        {state.lat !== undefined ? (
          <div className="flex items-center gap-2">
            <Label htmlFor={sortId} className="font-normal">
              {t("sort")}
            </Label>
            <Select
              value={state.sort}
              onValueChange={(value) => go({ ...state, sort: value as SearchState["sort"], offset: 0 })}
            >
              <SelectTrigger id={sortId} className="w-auto min-w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rating">{t("sortRating")}</SelectItem>
                <SelectItem value="distance">{t("sortDistance")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>
      <ResultsMap
        pins={pins}
        onSearchArea={(area) => go({ ...state, city_id: undefined, ...area, sort: state.sort, offset: 0 })}
      />
    </div>
  );
}
