"use client";

import { ArrowUpLeftIcon, CalendarDaysIcon, StarIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { components } from "@/api/schema";
import { ArchFrame } from "@/components/brand/ArchFrame";
import { Button } from "@/components/ui/button";
import { useMoney } from "@/hooks/useMoney";
import { Link } from "@/i18n/navigation";
import { formatDate } from "@/lib/calendar";
import { cityName, countryName } from "@/lib/names";
import { opportunityStay, type OpportunityQuery } from "@/lib/opportunities";

export function OpportunityCard({
  item,
  query,
}: {
  item: components["schemas"]["TravelOpportunity"];
  query: OpportunityQuery;
}) {
  const t = useTranslations("opportunities");
  const all = useTranslations();
  const locale = useLocale();
  const money = useMoney();
  const listing = item.listing;
  const href = `/listings/${listing.id}?${opportunityStay(item.check_in, item.check_out, query)}`;
  const rating =
    listing.review_count > 0 && listing.avg_rating
      ? new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en", { maximumFractionDigits: 2 }).format(
          Number(listing.avg_rating),
        )
      : null;
  return (
    <article
      className="group flex min-w-0 flex-col overflow-hidden rounded-3xl border bg-card transition-colors hover:border-primary/50"
      data-opportunity={item.kind}
    >
      <Link href={href} className="relative block p-3 pb-0">
        <ArchFrame
          src={listing.cover_url}
          alt={listing.title}
          className="aspect-[1.65]"
          sizes="(min-width: 1280px) 30vw, (min-width: 768px) 45vw, 90vw"
        >
          <span className="absolute start-3 top-3 rounded-full bg-background px-3 py-1.5 text-sm font-bold text-primary shadow-sm">
            {t(item.kind)}
          </span>
        </ArchFrame>
      </Link>
      <div className="flex flex-1 flex-col gap-4 p-5 md:p-6">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">
            {cityName(all, listing.city)} · {countryName(listing.country_code, locale)}
          </span>
          {rating ? (
            <span
              className="inline-flex shrink-0 items-center gap-1 text-sm"
              aria-label={all("search.rating", { rating, count: listing.review_count })}
            >
              <StarIcon className="size-3.5 fill-primary text-primary" aria-hidden />
              {rating}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">{t("newStay")}</span>
          )}
        </div>
        <h3 className="text-xl leading-8 font-bold">
          <Link href={href}>{listing.title}</Link>
        </h3>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarDaysIcon className="size-4 shrink-0" aria-hidden />
          {formatDate(item.check_in, locale)} – {formatDate(item.check_out, locale)}
        </p>
        <div className="mt-auto grid gap-2 border-t pt-5">
          <p className="text-sm text-muted-foreground">
            {t("totalFor", { count: new Intl.NumberFormat(locale).format(item.nights) })}
          </p>
          <p className="text-2xl leading-10 font-bold tracking-tight">
            {money(item.total_price, listing.currency)}
          </p>
          <details className="text-sm text-muted-foreground">
            <summary className="cursor-pointer">{t("breakdown")}</summary>
            <dl className="mt-3 grid gap-2">
              <div className="flex flex-wrap justify-between gap-2">
                <dt>{t("stay")}</dt>
                <dd>{money(item.stay_total, listing.currency)}</dd>
              </div>
              <div className="flex flex-wrap justify-between gap-2">
                <dt>{t("cleaning")}</dt>
                <dd>{money(item.cleaning_fee, listing.currency)}</dd>
              </div>
            </dl>
          </details>
        </div>
        {item.savings && item.reference_total ? (
          <div className="rounded-xl bg-primary/10 p-3 text-sm leading-7">
            <p className="font-bold text-primary">
              {t("saved", { amount: money(item.savings, listing.currency) })}
            </p>
            <p className="text-muted-foreground">
              {t("reference", {
                date: formatDate(query.preferred_check_in, locale),
                amount: money(item.reference_total, listing.currency),
              })}
            </p>
          </div>
        ) : item.shift_days !== 0 ? (
          <p className="text-sm leading-7 text-muted-foreground">
            {t("shifted", { count: new Intl.NumberFormat(locale).format(Math.abs(item.shift_days)) })}
          </p>
        ) : null}
        <Button asChild className="mt-1 w-full">
          <Link href={href} aria-label={t("bookStay", { title: listing.title })}>
            {t("book")}
            <ArrowUpLeftIcon className="size-4 ltr:rotate-90" aria-hidden />
          </Link>
        </Button>
      </div>
    </article>
  );
}
