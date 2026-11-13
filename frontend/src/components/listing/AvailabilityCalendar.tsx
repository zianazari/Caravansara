"use client";

import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { daysBetween, formatDate } from "@/lib/calendar";
import { NightlyPriceCalendar, type CalendarListing } from "./NightlyPriceCalendar";
import { useStayDates } from "./StayDates";

/** Inline date selection shares the booking dialog's prices and availability rules. */
export function AvailabilityCalendar({ city, listing }: { city: string; listing: CalendarListing }) {
  const t = useTranslations();
  const locale = useLocale();
  const { dates, setDates, booked, today } = useStayDates();
  const nights = dates.checkIn && dates.checkOut ? daysBetween(dates.checkIn, dates.checkOut) : 0;
  return (
    <section aria-labelledby="calendar-title" className="reveal grid min-w-0 gap-4 border-t pt-8">
      <div>
        <h2 id="calendar-title" className="text-2xl font-bold">
          {nights
            ? t("listing.nightsIn", { count: nights, city })
            : dates.checkIn
              ? t("dates.chooseCheckOut")
              : t("listing.chooseCheckIn")}
        </h2>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {dates.checkIn && dates.checkOut
            ? `${formatDate(dates.checkIn, locale)} – ${formatDate(dates.checkOut, locale)}`
            : t("listing.calendarHint")}
        </p>
      </div>
      <NightlyPriceCalendar
        listing={listing}
        value={dates}
        onChange={setDates}
        booked={booked}
        today={today}
        months={2}
      />
      <div className="flex justify-end">
        <Button variant="link" size="sm" onClick={() => setDates({})} disabled={!dates.checkIn}>
          {t("dates.clear")}
        </Button>
      </div>
    </section>
  );
}
