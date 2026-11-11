"use client";

import { StarIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { components } from "@/api/schema";
import { ArchFrame } from "@/components/brand/ArchFrame";
import { HeartButton } from "@/components/wishlist/HeartButton";
import { useMoney } from "@/hooks/useMoney";
import { Link } from "@/i18n/navigation";
import { badgeOf } from "@/lib/badge";
import { formatDate } from "@/lib/calendar";
import { cityName, countryName } from "@/lib/names";

type Result = components["schemas"]["SearchResult"];

/**
 * One search result (FR-017): cover photo, title, city, rating, price per night and, with dates, the total.
 * A listing without a photo or without reviews gets a placeholder, never a broken image or a zero rating.
 *
 * Caravansara theme (specs/007-caravansara-theme, FR-006, contracts/ui.md): the photo, a plain rounded rectangle
 * since feature 017, with a "guest favourite" or "new" badge in its top corner; then the city and country with the rating, the title, the
 * place type and, for a search with dates, the dates; the price per night and the total last, as on the
 * booking sites people know. The whole card is one link; the wishlist heart (feature 012) is a separate button
 * on the photo's other top corner, not inside the link, because a button inside a link is not allowed.
 */
export function ResultCard({ result, nights, stay }: { result: Result; nights?: number; stay: string }) {
  const t = useTranslations();
  const locale = useLocale();
  const money = useMoney();
  const badge = badgeOf(result);
  const rating =
    badge !== "new" && result.avg_rating
      ? new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en", { maximumFractionDigits: 2 }).format(
          Number(result.avg_rating),
        )
      : null;
  const query = new URLSearchParams(stay);
  const checkIn = query.get("check_in");
  const checkOut = query.get("check_out");
  return (
    <article className="relative grid min-w-0 grid-cols-1 gap-2">
      <Link
        href={`/listings/${result.id}${stay ? `?${stay}` : ""}`}
        className="group grid min-w-0 grid-cols-1 gap-1 rounded-xl focus-visible:outline-2"
      >
        <ArchFrame
          src={result.cover_url}
          alt={result.cover_url ? "" : t("search.noPhoto")}
          sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="mb-1 aspect-[1/0.96] transition-[transform,box-shadow] duration-300 ease-(--ease-soft) group-hover:-translate-y-1 group-hover:shadow-[0_18px_32px_-18px_color-mix(in_srgb,var(--foreground)_45%,transparent)]"
        >
          {badge ? (
            <span className="absolute start-2.5 top-2.5 max-w-[calc(100%-3.75rem)] truncate rounded-full bg-background px-2 py-0.5 text-[11px] font-bold text-foreground shadow-sm sm:start-3 sm:top-3 sm:px-2.5 sm:py-1 sm:text-xs">
              {t(badge === "new" ? "badge.new" : "badge.guestFavourite")}
            </span>
          ) : null}
        </ArchFrame>
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 truncate text-sm font-bold">
            <span>{cityName(t, result.city)}</span>
            {locale === "fa" ? "، " : ", "}
            <span>{countryName(result.country_code, locale)}</span>
          </p>
          {rating ? (
            <span
              role="img"
              className="flex shrink-0 items-center gap-1 text-sm"
              aria-label={t("search.rating", { rating, count: result.review_count })}
            >
              <StarIcon className="size-3.5 fill-current" aria-hidden />
              <span aria-hidden>{rating}</span>
            </span>
          ) : null}
        </div>
        <h3 className="truncate text-sm text-muted-foreground transition-colors group-hover:text-primary">
          {result.title}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t(`propertyTypes.${result.property_type}`)}
          {result.distance_km !== null && result.distance_km !== undefined
            ? ` · ${t("search.distance", { km: new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en", { maximumFractionDigits: 1 }).format(result.distance_km) })}`
            : ""}
        </p>
        {checkIn && checkOut ? (
          <p className="text-sm text-muted-foreground">
            {formatDate(checkIn, locale)} – {formatDate(checkOut, locale)}
          </p>
        ) : null}
        <p className="break-words">
          <span className="text-sm font-bold">{money(result.price_per_night, result.currency)}</span>{" "}
          <span className="text-sm text-muted-foreground">{t("search.perNight")}</span>
        </p>
        {result.total_price && nights ? (
          <p className="text-sm break-words text-muted-foreground">
            {money(result.total_price, result.currency)} · {t("search.total", { nights })}
          </p>
        ) : null}
      </Link>
      <HeartButton
        listingId={result.id}
        title={result.title}
        className="absolute end-2.5 top-2.5 size-8 sm:end-3 sm:top-3 sm:size-9"
      />
    </article>
  );
}
