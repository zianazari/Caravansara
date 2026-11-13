"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMoney } from "@/hooks/useMoney";
import { priceBreakdown } from "@/lib/bookingView";
import { formatDate } from "@/lib/calendar";
import type { NightlyPrice, PriceQuote } from "@/lib/pricing";
import { toHundredths } from "@/lib/money";

/** nights × price, cleaning fee and total, counted exactly as the API does (FR-023). */
export function PriceBreakdown({
  pricePerNight: listingPrice,
  cleaningFee: listingCleaning,
  currency: listingCurrency,
  checkIn,
  checkOut,
  quote,
  nightlyPrices,
  totalPrice,
}: {
  pricePerNight: string;
  cleaningFee: string;
  currency: string;
  checkIn: string;
  checkOut: string;
  quote?: PriceQuote;
  nightlyPrices?: NightlyPrice[];
  totalPrice?: string;
}) {
  const t = useTranslations("booking");
  const pricing = useTranslations("pricing");
  const locale = useLocale();
  const money = useMoney();
  const currency = quote?.currency ?? listingCurrency;
  const cleaningFee = quote?.cleaning_fee ?? listingCleaning;
  const pricePerNight = quote?.base_price ?? listingPrice;
  const p = priceBreakdown(pricePerNight, cleaningFee, checkIn, checkOut);
  const rows = quote?.nights ?? nightlyPrices ?? [];
  const exactTotal = quote?.total_price ?? totalPrice;
  // A saved booking or server quote is authoritative; nightly base multiplication is only for legacy stays.
  const cents = exactTotal
    ? toHundredths(exactTotal) - toHundredths(cleaningFee)
    : rows.reduce((sum, row) => sum + toHundredths(row.amount), 0n);
  const stay =
    quote?.stay_total ??
    (rows.length || exactTotal ? `${cents / 100n}.${(cents % 100n).toString().padStart(2, "0")}` : p.stay);
  return (
    <div className="grid gap-3 text-sm">
      <dl className="grid gap-1">
        <div className="flex justify-between gap-4">
          <dt>
            {rows.length
              ? pricing("stayTotal")
              : t("nightsLine", { price: money(pricePerNight, currency), nights: p.nights })}
          </dt>
          <dd className="text-end">{money(stay, currency)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>{t("cleaning")}</dt>
          <dd className="text-end">{money(cleaningFee, currency)}</dd>
        </div>
        <div className="flex justify-between gap-4 border-t pt-2 text-base font-semibold">
          <dt>{t("total")}</dt>
          <dd className="text-end">{money(exactTotal ?? p.total, currency)}</dd>
        </div>
      </dl>
      {rows.length ? (
        <div className="border-t pt-3">
          <details>
            <summary className="cursor-pointer text-primary">{pricing("nightDetails")}</summary>
            <div className="mt-3 grid max-h-64 gap-2 overflow-y-auto pe-1">
              {rows.map((night) => (
                <div
                  key={night.date}
                  className="grid grid-cols-[1fr_auto] gap-x-3 rounded-lg bg-muted/40 p-2"
                >
                  <span>{formatDate(night.date, locale)}</span>
                  <span>{money(night.amount, currency)}</span>
                  <span className="col-span-2 text-xs text-muted-foreground">
                    {pricing(`source_${night.source}`)}
                    {night.label ? ` · ${night.label}` : ""}
                  </span>
                </div>
              ))}
            </div>
          </details>
        </div>
      ) : null}
    </div>
  );
}
