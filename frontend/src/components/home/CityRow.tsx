"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { api } from "@/api/client";
import { ResultCard } from "@/components/search/ResultCard";
import { Link } from "@/i18n/navigation";
import type { CategoryFilter } from "@/lib/categories";
import { cityName } from "@/lib/names";

export type { CategoryFilter } from "@/lib/categories";

const FIVE_MINUTES = 5 * 60 * 1000;

/**
 * One row of the home page: a suggested city's best places, top rated first (specs/007-caravansara-theme,
 * FR-013, answer Q1). It uses today's search, so the API does not change. It loads only when it comes within
 * 200 px of the screen, so the first view stays as fast as in 005 and a visit that stops at the hero asks for
 * nothing; results stay cached for five minutes (research R4). A city that is not found, has no places, or
 * fails shows no row, and the rest of the page is unaffected (US1/AC5).
 */
export function CityRow({
  city,
  category,
  filter = {},
}: {
  /** The city's English name, as in GET /cities. */
  city: string;
  category?: string;
  filter?: CategoryFilter;
}) {
  const t = useTranslations();
  const ref = useRef<HTMLElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || near) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setNear(true);
      },
      { rootMargin: "200px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [near]);

  const found = useQuery({
    queryKey: ["home-city", city],
    enabled: near,
    staleTime: FIVE_MINUTES,
    queryFn: async () => {
      const { data } = await api.GET("/api/v1/cities", { params: { query: { q: city, limit: 8 } } });
      // The exact name only: a search for "Tehran" may also suggest "Tehranpars".
      return data?.find((c) => c.name === city) ?? null;
    },
  });
  const cityId = found.data?.id;
  const places = useQuery({
    queryKey: ["home-row", cityId, filter],
    enabled: cityId !== undefined,
    staleTime: FIVE_MINUTES,
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/search/listings", {
        params: { query: { city_id: cityId!, sort: "rating", limit: 8, ...filter } },
      });
      if (!data) {
        console.error("home city row failed", city, error);
        return [];
      }
      return data.items;
    },
  });

  const items = places.data ?? [];
  if (cityId === undefined || items.length === 0) {
    // An empty marker the observer can watch; it takes no space, so a hidden row leaves no gap.
    return <section ref={ref} aria-hidden className="h-px" />;
  }

  const all = new URLSearchParams({ city_id: String(cityId), adults: "1" });
  for (const id of filter.amenity_ids ?? []) all.append("amenity_ids", String(id));
  if (filter.pets) all.set("pets", String(filter.pets));
  if (filter.property_type) all.set("property_type", filter.property_type);
  if (category) all.set("category", category);
  const name = cityName(t, city);

  return (
    <section ref={ref} aria-labelledby={`row-${city}`} className="grid min-w-0 gap-4 pb-10 last:pb-0">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id={`row-${city}`} className="text-xl font-bold">
          {t("home.popularIn", { city: name })}
        </h2>
        <Link
          href={`/search?${all.toString()}`}
          className="shrink-0 text-sm font-bold text-primary hover:underline"
        >
          {t("home.showAll")}
        </Link>
      </div>
      {/* A phone scrolls the row sideways, card by card; a wide screen shows a grid of four. */}
      <div className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0 lg:grid-cols-4">
        {items.map((result) => (
          <div key={result.id} className="w-[78%] shrink-0 snap-start sm:w-[45%] md:w-auto">
            <ResultCard result={result} stay="" />
          </div>
        ))}
      </div>
    </section>
  );
}
