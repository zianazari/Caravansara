"use client";

import { useTranslations } from "next-intl";
import { useMoney } from "@/hooks/useMoney";
import { priceBreakdown } from "@/lib/bookingView";

/** nights × price, cleaning fee and total, counted exactly as the API does (FR-023). */
export function PriceBreakdown({
  pricePerNight,
  cleaningFee,
  currency,
  checkIn,
  checkOut,
}: {
  pricePerNight: string;
  cleaningFee: string;
  currency: string;
  checkIn: string;
  checkOut: string;
}) {
  const t = useTranslations("booking");
  const money = useMoney();
  const p = priceBreakdown(pricePerNight, cleaningFee, checkIn, checkOut);
  return (
    <dl className="grid gap-1 text-sm">
      <div className="flex justify-between gap-4">
        <dt>{t("nightsLine", { price: money(pricePerNight, currency), nights: p.nights })}</dt>
        <dd className="text-end">{money(p.stay, currency)}</dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt>{t("cleaning")}</dt>
        <dd className="text-end">{money(cleaningFee, currency)}</dd>
      </div>
      <div className="flex justify-between gap-4 border-t pt-2 text-base font-semibold">
        <dt>{t("total")}</dt>
        <dd className="text-end">{money(p.total, currency)}</dd>
      </div>
    </dl>
  );
}
