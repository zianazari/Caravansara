"use client";

import { ImageOffIcon, StarIcon } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import type { components } from "@/api/schema";
import { useMoney } from "@/hooks/useMoney";
import { Link } from "@/i18n/navigation";
import { cityName } from "@/lib/names";

type Result = components["schemas"]["SearchResult"];

/**
 * One search result (FR-017): cover photo, title, city, rating, price per night and, with dates, the total.
 * A listing without a photo or without reviews gets a placeholder, never a broken image or a zero rating.
 */
export function ResultCard({ result, nights, stay }: { result: Result; nights?: number; stay: string }) {
  const t = useTranslations();
  const locale = useLocale();
  const money = useMoney();
  const rating = result.avg_rating
    ? new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en", { maximumFractionDigits: 2 }).format(
        Number(result.avg_rating),
      )
    : null;
  return (
    <article className="grid gap-2">
      <Link
        href={`/listings/${result.id}${stay ? `?${stay}` : ""}`}
        className="grid gap-2 rounded-xl focus-visible:outline-2"
      >
        <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-muted">
          {result.cover_url ? (
            <Image
              src={result.cover_url}
              alt=""
              fill
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              className="object-cover"
            />
          ) : (
            <span className="grid size-full place-content-center gap-1 text-center text-sm text-muted-foreground">
              <ImageOffIcon className="mx-auto size-6" aria-hidden />
              {t("search.noPhoto")}
            </span>
          )}
        </div>
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 font-semibold">{result.title}</h3>
          {rating ? (
            <span
              role="img"
              className="flex shrink-0 items-center gap-1 text-sm"
              aria-label={t("search.rating", { rating, count: result.review_count })}
            >
              <StarIcon className="size-4 fill-current" aria-hidden />
              <span aria-hidden>{rating}</span>
            </span>
          ) : (
            <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-xs">{t("search.new")}</span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {cityName(t, result.city)}
          {result.distance_km !== null && result.distance_km !== undefined
            ? ` · ${t("search.distance", { km: new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en", { maximumFractionDigits: 1 }).format(result.distance_km) })}`
            : ""}
        </p>
        <p className="break-words">
          <span className="font-semibold">{money(result.price_per_night, result.currency)}</span>{" "}
          <span className="text-sm text-muted-foreground">{t("search.perNight")}</span>
        </p>
        {result.total_price && nights ? (
          <p className="text-sm break-words">
            {money(result.total_price, result.currency)} · {t("search.total", { nights })}
          </p>
        ) : null}
      </Link>
    </article>
  );
}
