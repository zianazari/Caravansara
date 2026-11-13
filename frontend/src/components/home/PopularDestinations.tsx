"use client";

import Image, { type StaticImageData } from "next/image";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpLeftIcon, MapPinIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { api } from "@/api/client";
import { Link } from "@/i18n/navigation";
import { cityName } from "@/lib/names";
import { Button } from "@/components/ui/button";
import tehran from "@/assets/destination-tehran.jpg";
import isfahan from "@/assets/destination-isfahan.jpg";
import shiraz from "@/assets/destination-shiraz.jpg";

const PHOTOS: Record<string, StaticImageData> = { Tehran: tehran, Isfahan: isfahan, Shiraz: shiraz };

/** Rankings and IDs come from the catalog, not hardcoded destinations or sample listing links. */
export function PopularDestinations() {
  const t = useTranslations();
  const cities = useQuery({
    queryKey: ["cities", "popular", "IR", 3],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/cities", {
        params: { query: { sort: "popular", country: "IR", limit: 3 } },
      });
      if (!data) throw new Error(error?.error?.code ?? "cities_unavailable");
      return data;
    },
  });
  if (cities.data?.length === 0) return null;
  return (
    <section
      id="popular-destinations"
      aria-labelledby="destinations-title"
      className="grid gap-6 md:gap-8"
      aria-busy={cities.isPending}
    >
      <div>
        <span className="mb-5 block h-1 w-16 bg-copper" aria-hidden />
        <h2 id="destinations-title" className="text-3xl leading-relaxed font-bold md:text-4xl">
          {t("cinematic.destinations")}
        </h2>
        <p className="mt-2 text-base text-muted-foreground md:text-lg">{t("cinematic.destinationsNote")}</p>
      </div>
      {cities.isError ? (
        <div className="flex flex-wrap items-center gap-4 rounded-2xl border p-6" role="status">
          <p>{t("errors.unknown")}</p>
          <Button variant="outline" onClick={() => void cities.refetch()}>
            {t("common.retry")}
          </Button>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-3">
          {cities.isPending
            ? Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="aspect-[1.6] animate-pulse rounded-2xl bg-muted" aria-hidden />
              ))
            : cities.data?.map((city) => {
                const photo = PHOTOS[city.name];
                return (
                  <Link
                    key={city.id}
                    href={{ pathname: "/search", query: { city_id: city.id, adults: 1 } }}
                    className="group relative isolate block aspect-[1.6] overflow-hidden rounded-2xl bg-card text-on-dark"
                  >
                    {photo ? (
                      <Image
                        src={photo}
                        alt=""
                        fill
                        sizes="(min-width: 768px) 33vw, 100vw"
                        className="object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    ) : (
                      <MapPinIcon
                        className="absolute start-1/2 top-1/3 size-14 -translate-x-1/2 text-copper rtl:translate-x-1/2"
                        aria-hidden
                      />
                    )}
                    <span className="absolute inset-0 bg-linear-to-t from-hero-shade via-hero-shade/10 to-transparent" />
                    <span className="absolute inset-x-6 bottom-6 flex items-end justify-between gap-4">
                      <span className="grid gap-1">
                        <span className="text-2xl leading-relaxed font-bold md:text-3xl">
                          {cityName(t, city.name)}
                        </span>
                        <span className="text-base">{t("cinematic.seeStays")}</span>
                      </span>
                      <span className="grid size-10 shrink-0 place-items-center rounded-full border border-on-dark/70 transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                        <ArrowUpLeftIcon className="size-5 ltr:rotate-90" aria-hidden />
                      </span>
                    </span>
                  </Link>
                );
              })}
        </div>
      )}
    </section>
  );
}
