"use client";

import { useTranslations } from "next-intl";
import { useMoney } from "@/hooks/useMoney";

/**
 * The phone's booking bar on a listing (specs/007-caravansara-theme, FR-007, research R7): the price per night
 * and "Reserve", fixed at the bottom where the bottom bar is on other pages. "Reserve" takes the visitor to the
 * booking box further down, which keeps every rule of 005 (dates, guests, own listing, the draft); a second
 * copy of the box in a dialog would have to keep two forms in step.
 */
export function MobileBookingBar({ price, currency }: { price: string; currency: string }) {
  const t = useTranslations();
  const money = useMoney();
  return (
    <div className="no-print fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t bg-card px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:hidden">
      <p className="text-sm">{t("listing.perNight", { price: money(price, currency) })}</p>
      <a
        href="#booking"
        className="rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90"
      >
        {t("booking.reserve")}
      </a>
    </div>
  );
}
