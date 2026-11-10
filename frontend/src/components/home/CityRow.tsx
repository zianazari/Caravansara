"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { api } from "@/api/client";
import { ChevronLeftIcon, ChevronRightIcon, ArrowLeftIcon } from "lucide-react";
import { HomeCard } from "./HomeCard";
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
  const locale = useLocale();
  const ref = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
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
        params: { query: { city_id: cityId!, sort: "rating", limit: 12, ...filter } },
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

  /** One screen of cards back or forward; in Persian, forward is to the left. */
  function scroll(forward: boolean) {
    const el = track.current;
    if (!el) return;
    const sign = (locale === "fa" ? -1 : 1) * (forward ? 1 : -1);
    el.scrollBy({ left: sign * el.clientWidth * 0.9, behavior: "smooth" });
  }
  const Back = locale === "fa" ? ChevronRightIcon : ChevronLeftIcon;
  const Next = locale === "fa" ? ChevronLeftIcon : ChevronRightIcon;

  return (
    <section ref={ref} aria-labelledby={`row-${city}`} className="grid min-w-0 gap-4 pb-10 last:pb-0">
      <div className="flex items-center justify-between gap-4">
        <h2 id={`row-${city}`} className="flex items-center gap-2 text-xl font-bold">
          <Link
            href={`/search?${all.toString()}`}
            className="flex items-center gap-2 rounded-lg hover:underline"
          >
            {t("home.popularIn", { city: name })}
            <span className="sr-only">{` (${t("home.showAll")})`}</span>
            <span className="grid size-8 place-items-center rounded-full bg-muted" aria-hidden>
              <ArrowLeftIcon className="size-4 ltr:rotate-180" />
            </span>
          </Link>
        </h2>
        {/* Wide screens: arrows move the row a screen at a time. On a phone the row is swiped. */}
        <div className="hidden gap-2 md:flex">
          <button
            type="button"
            onClick={() => scroll(false)}
            aria-label={t("home.previous", { city: name })}
            className="grid size-8 place-items-center rounded-full border bg-card shadow-sm hover:shadow-md"
          >
            <Back className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => scroll(true)}
            aria-label={t("home.next", { city: name })}
            className="grid size-8 place-items-center rounded-full border bg-card shadow-sm hover:shadow-md"
          >
            <Next className="size-4" aria-hidden />
          </button>
        </div>
      </div>
      {/* One row that scrolls sideways, card by card: about 2 on a phone and 7 on a wide screen (feature 017). */}
      <div
        ref={track}
        className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] md:mx-0 md:px-0"
      >
        {items.map((result) => (
          <div
            key={result.id}
            className="w-[44%] shrink-0 snap-start sm:w-[30%] md:w-[calc((100%-3*1rem)/4)] lg:w-[calc((100%-4*1rem)/5)] xl:w-[calc((100%-5*1rem)/6)] 2xl:w-[calc((100%-6*1rem)/7)]"
          >
            <HomeCard result={result} />
          </div>
        ))}
      </div>
    </section>
  );
}
