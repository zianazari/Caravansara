"use client";

import { StarIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { components } from "@/api/schema";
import { ArchFrame } from "@/components/brand/ArchFrame";
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
 * Caravansara theme (specs/007-caravansara-theme, FR-006, contracts/ui.md): the photo sits in the lower arch,
 * with a "guest favourite" or "new" badge on it; then the city and country with the rating, the title, the
 * place type and, for a search with dates, the dates; the price per night and the total last, as on the
 * booking sites people know. The whole card is one link. No wishlist heart: that comes with its own feature
 * (answer Q3), and the arch's top corner stays free for it.
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
    <article className="grid gap-2">
      <Link
        href={`/listings/${result.id}${stay ? `?${stay}` : ""}`}
        className="group grid gap-1 rounded-xl focus-visible:outline-2"
      >
        <ArchFrame
          src={result.cover_url}
          alt={result.cover_url ? "" : t("search.noPhoto")}
          sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="mb-2 aspect-[1/0.95] md:aspect-[1/1.04]"
        >
          {badge ? (
            <span className="absolute start-3 bottom-3 rounded-full bg-background px-3 py-1 text-xs font-bold text-foreground shadow-sm">
              {t(badge === "new" ? "badge.new" : "badge.guestFavourite")}
            </span>
          ) : null}
        </ArchFrame>
        <div className="flex items-start justify-between gap-2">
          <p className="font-bold">
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
        <h3 className="line-clamp-1 text-sm text-muted-foreground group-hover:underline">{result.title}</h3>
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
        <p className="mt-1 break-words">
          <span className="font-extrabold">{money(result.price_per_night, result.currency)}</span>{" "}
          <span className="text-sm text-muted-foreground">{t("search.perNight")}</span>
        </p>
        {result.total_price && nights ? (
          <p className="text-sm break-words text-muted-foreground">
            {money(result.total_price, result.currency)} · {t("search.total", { nights })}
          </p>
        ) : null}
      </Link>
    </article>
  );
}
