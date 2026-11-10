"use client";

import { StarIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { components } from "@/api/schema";
import { ArchFrame } from "@/components/brand/ArchFrame";
import { HeartButton } from "@/components/wishlist/HeartButton";
import { useMoney } from "@/hooks/useMoney";
import { Link } from "@/i18n/navigation";
import { badgeOf } from "@/lib/badge";
import { cityName } from "@/lib/names";

type Result = components["schemas"]["SearchResult"];

/**
 * A compact card for the home page's city rows (feature 017, owner's request with a reference picture): a
 * plain rounded photo instead of the arch, so the photo can be smaller and more places fit a row. The badge
 * sits on the photo's top corner and the heart on the other, as on the booking sites people know; then the
 * place type in the city, the title, and the nightly price with the rating.
 */
export function HomeCard({ result }: { result: Result }) {
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
  return (
    <article className="relative grid min-w-0 grid-cols-1 gap-1.5">
      <Link
        href={`/listings/${result.id}`}
        className="group grid min-w-0 grid-cols-1 gap-1.5 rounded-2xl focus-visible:outline-2"
      >
        {/* Default picture when there is no photo or its file is missing (feature 020). */}
        <ArchFrame
          src={result.cover_url}
          alt={result.cover_url ? "" : t("search.noPhoto")}
          sizes="(min-width: 1536px) 14vw, (min-width: 1280px) 16vw, (min-width: 1024px) 19vw, (min-width: 768px) 24vw, 45vw"
          className="aspect-[1/0.96] transition-transform"
        >
          {badge ? (
            <span className="absolute start-2.5 top-2.5 max-w-[calc(100%-3.75rem)] truncate rounded-full bg-background px-2 py-0.5 text-[11px] font-bold text-foreground shadow-sm sm:start-3 sm:top-3 sm:px-2.5 sm:py-1 sm:text-xs">
              {t(badge === "new" ? "badge.new" : "badge.guestFavourite")}
            </span>
          ) : null}
        </ArchFrame>
        <h3 className="truncate text-sm font-bold">
          {t("home.typeInCity", {
            type: t(`propertyTypes.${result.property_type}`),
            city: cityName(t, result.city),
          })}
        </h3>
        <p className="truncate text-sm text-muted-foreground group-hover:underline">{result.title}</p>
        <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
          <span>
            <span className="font-semibold text-foreground">
              {money(result.price_per_night, result.currency)}
            </span>{" "}
            {t("search.perNight")}
          </span>
          {rating ? (
            <span
              role="img"
              className="flex items-center gap-0.5"
              aria-label={t("search.rating", { rating, count: result.review_count })}
            >
              <span aria-hidden>·</span>
              <StarIcon className="size-3 fill-current" aria-hidden />
              <span aria-hidden>{rating}</span>
            </span>
          ) : null}
        </p>
      </Link>
      {/* Outside the link: a button inside a link is not allowed. Over the photo's top corner. */}
      <HeartButton
        listingId={result.id}
        title={result.title}
        className="absolute end-2.5 top-2.5 size-8 sm:end-3 sm:top-3 sm:size-9"
      />
    </article>
  );
}
