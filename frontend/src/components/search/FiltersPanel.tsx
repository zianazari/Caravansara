"use client";

import { useQuery } from "@tanstack/react-query";
import { SlidersHorizontalIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { amenityCategoryName, amenityName } from "@/lib/names";
import { type SearchState, toApiQuery } from "@/lib/searchParams";

/**
 * Amenity filters (FR-019, US1/AC3): grouped and translated, each with the number of places that remain if
 * it is added (GET /search/filters). A place must have every chosen amenity. Choices apply together, so the
 * results are not reloaded on every tick.
 */
export function FiltersPanel({
  state,
  onApply,
}: {
  state: SearchState;
  onApply: (amenityIds: number[]) => void;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<number[]>(state.amenity_ids);

  const draft = { ...state, amenity_ids: chosen };
  const counts = useQuery({
    queryKey: ["filters", toApiQuery(draft)],
    enabled: open,
    queryFn: async () => {
      // The filter counts take the same search without paging or sorting.
      const {
        city_id,
        lat,
        lng,
        radius_km,
        check_in,
        check_out,
        adults,
        children,
        infants,
        pets,
        amenity_ids,
      } = toApiQuery(draft);
      const query = {
        city_id,
        lat,
        lng,
        radius_km,
        check_in,
        check_out,
        adults,
        children,
        infants,
        pets,
        amenity_ids,
      };
      const { data } = await api.GET("/api/v1/search/filters", { params: { query } });
      return data ?? null;
    },
  });

  const number = (n: number) => new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en").format(n);
  const groups = new Map<string, NonNullable<typeof counts.data>["amenities"]>();
  for (const amenity of counts.data?.amenities ?? []) {
    groups.set(amenity.category, [...(groups.get(amenity.category) ?? []), amenity]);
  }
  const toggle = (id: number, on: boolean) =>
    setChosen((ids) => (on ? [...ids, id] : ids.filter((x) => x !== id)).sort((a, b) => a - b));

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setChosen(state.amenity_ids); // start from the search shown on the page
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <SlidersHorizontalIcon />
          {t("search.filters")}
          {state.amenity_ids.length ? ` (${number(state.amenity_ids.length)})` : ""}
        </Button>
      </DialogTrigger>
      <DialogContent closeLabel={t("common.close")} side="end" className="content-start bg-surface">
        <DialogTitle>{t("search.filtersTitle")}</DialogTitle>
        <DialogDescription>{t("search.filtersHint")}</DialogDescription>
        {counts.isPending ? <p>{t("common.loading")}</p> : null}
        {[...groups.entries()].map(([category, amenities]) => (
          <fieldset key={category} className="grid gap-2">
            <legend className="mb-1 font-semibold">{amenityCategoryName(t, category)}</legend>
            {amenities.map((amenity) => (
              <label key={amenity.id} className="flex items-center gap-3">
                <Checkbox
                  checked={chosen.includes(amenity.id)}
                  onCheckedChange={(on) => toggle(amenity.id, on === true)}
                />
                <span className="flex-1">{amenityName(t, amenity.name)}</span>
                <span className="text-sm text-muted-foreground">
                  {t("search.filtersCount", { count: number(amenity.listings) })}
                </span>
              </label>
            ))}
          </fieldset>
        ))}
        <div className="sticky bottom-0 flex justify-between gap-2 bg-surface pt-2">
          <Button variant="ghost" onClick={() => setChosen([])}>
            {t("search.clearFilters")}
          </Button>
          <Button
            onClick={() => {
              onApply(chosen);
              setOpen(false);
            }}
          >
            {t("search.showResults")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
