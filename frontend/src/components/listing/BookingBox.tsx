"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { DateRangePicker } from "@/components/date/DateRangePicker";
import { stayIsFree } from "@/lib/availability";
import { useStayDates } from "./StayDates";
import { PriceBreakdown } from "@/components/booking/PriceBreakdown";
import { GuestPicker, type Guests } from "@/components/search/GuestPicker";
import { Button } from "@/components/ui/button";
import { useMe } from "@/hooks/useAuth";
import { useMoney } from "@/hooks/useMoney";
import { useRouter } from "@/i18n/navigation";
import { draftFor } from "@/lib/bookingDraft";
import { preCheck } from "@/lib/bookingView";
import { todayInZone } from "@/lib/cityTime";
import { parseSearch } from "@/lib/searchParams";

export type BookingBoxListing = {
  id: number;
  host_id: number;
  price_per_night: string;
  cleaning_fee: string;
  currency: string;
  max_guests: number;
  pets_allowed: boolean;
  max_pets: number;
  timezone: string;
};

/**
 * Price and booking on the listing page (US3, FR-023, FR-024). The dates and guests come from the search
 * address and can be changed here. "Reserve" saves the choices as a draft (with its idempotency key) and opens
 * the booking page; a visitor who is not signed in is sent to log in on the way and comes back (US2/AC7).
 */
export function BookingBox({ listing }: { listing: BookingBoxListing }) {
  const t = useTranslations();
  const money = useMoney();
  const router = useRouter();
  const me = useMe();
  const initial = parseSearch(useSearchParams());
  // The page's calendar and this box share the dates (feature 019).
  const { dates, setDates, booked } = useStayDates();
  const [guests, setGuests] = useState<Guests>({
    adults: initial.adults,
    children: initial.children,
    infants: initial.infants,
    pets: initial.pets,
  });
  const [problem, setProblem] = useState<string | null>(null);
  const own = me.data?.id === listing.host_id;

  function reserve() {
    if (!dates.checkIn || !dates.checkOut) {
      setProblem(t("booking.chooseDates"));
      return;
    }
    const stay = { check_in: dates.checkIn, check_out: dates.checkOut, ...guests };
    if (!stayIsFree(dates.checkIn, dates.checkOut, booked)) {
      setProblem(t("errors.dates_unavailable"));
      return;
    }
    const issue = preCheck(listing, stay);
    if (issue) {
      setProblem(t(`booking.${issue}`));
      return;
    }
    setProblem(null);
    draftFor({ listing_id: listing.id, ...stay });
    router.push(`/book/${listing.id}`);
  }

  return (
    <aside
      aria-label={t("listing.price")}
      className="grid gap-4 rounded-2xl border bg-card p-5 shadow-xl shadow-foreground/10"
    >
      <p className="text-lg font-semibold">
        {t("listing.perNight", { price: money(listing.price_per_night, listing.currency) })}
      </p>
      <DateRangePicker
        value={dates}
        onChange={(next) => {
          setDates(next);
          setProblem(null);
        }}
        min={todayInZone(listing.timezone)}
        booked={booked}
      />
      <GuestPicker value={guests} onChange={setGuests} />
      {dates.checkIn && dates.checkOut ? (
        <PriceBreakdown
          pricePerNight={listing.price_per_night}
          cleaningFee={listing.cleaning_fee}
          currency={listing.currency}
          checkIn={dates.checkIn}
          checkOut={dates.checkOut}
        />
      ) : (
        <p className="text-sm text-muted-foreground">{t("listing.chooseDates")}</p>
      )}
      {problem ? (
        <p role="alert" className="text-sm text-destructive">
          {problem}
        </p>
      ) : null}
      {own ? (
        <p className="text-sm text-muted-foreground">{t("booking.ownListing")}</p>
      ) : (
        <Button size="lg" className="rounded-full" onClick={reserve}>
          {t("booking.reserve")}
        </Button>
      )}
    </aside>
  );
}
