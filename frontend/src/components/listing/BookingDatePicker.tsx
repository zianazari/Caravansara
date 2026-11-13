"use client";

import { CalendarIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { PriceBreakdown } from "@/components/booking/PriceBreakdown";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { usePriceQuote } from "@/hooks/usePriceQuote";
import { stayIsFree } from "@/lib/availability";
import { addDays, daysBetween, formatDate } from "@/lib/calendar";
import { NightlyPriceCalendar, type CalendarListing } from "./NightlyPriceCalendar";
import { useStayDates } from "./StayDates";

/** Edits a local range; dismissing never changes the dates in the booking box. */
export function BookingDatePicker({
  listing,
  onConfirm,
}: {
  listing: CalendarListing & { cleaning_fee: string };
  onConfirm?: () => void;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const { dates, setDates, booked, today } = useStayDates();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(dates);
  const quote = usePriceQuote(
    listing.id,
    open ? draft.checkIn : undefined,
    open ? draft.checkOut : undefined,
  );
  const complete = Boolean(draft.checkIn && draft.checkOut);
  const clearing = !draft.checkIn && !draft.checkOut && Boolean(dates.checkIn || dates.checkOut);
  const valid = Boolean(
    complete &&
    draft.checkIn! >= today &&
    draft.checkOut! > draft.checkIn! &&
    draft.checkOut! <= addDays(today, 365) &&
    stayIsFree(draft.checkIn!, draft.checkOut!, booked),
  );
  const shown =
    dates.checkIn && dates.checkOut
      ? `${formatDate(dates.checkIn, locale)} – ${formatDate(dates.checkOut, locale)}`
      : dates.checkIn
        ? `${formatDate(dates.checkIn, locale)} – ${t("dates.chooseCheckOut")}`
        : t("dates.anyDates");

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setDraft(dates);
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-start font-normal"
          aria-label={`${t("dates.dates")}: ${shown}`}
        >
          <CalendarIcon />
          <span className="truncate">{shown}</span>
        </Button>
      </DialogTrigger>
      <DialogContent
        closeLabel={t("common.close")}
        className="max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-4xl gap-5 rounded-3xl p-4 sm:p-6"
      >
        <div className="grid gap-2">
          <DialogTitle className="text-xl sm:text-2xl">{t("priceCalendar.title")}</DialogTitle>
          <DialogDescription>{t("priceCalendar.checkoutNote")}</DialogDescription>
        </div>
        <div className="grid min-w-0 gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,19rem)]">
          <NightlyPriceCalendar
            listing={listing}
            value={draft}
            onChange={setDraft}
            booked={booked}
            today={today}
          />
          <section
            aria-label={t("priceCalendar.summary")}
            className="grid min-w-0 content-start gap-4 rounded-2xl border bg-background/50 p-4"
          >
            <h3 className="text-lg font-bold">{t("priceCalendar.summary")}</h3>
            <dl className="grid gap-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{t("booking.checkIn")}</dt>
                <dd>{draft.checkIn ? formatDate(draft.checkIn, locale) : "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{t("booking.checkOut")}</dt>
                <dd>{draft.checkOut ? formatDate(draft.checkOut, locale) : "—"}</dd>
              </div>
            </dl>
            <div aria-live="polite" aria-atomic="true" className="grid gap-3">
              {complete ? (
                <>
                  <p className="rounded-xl bg-primary/10 px-3 py-2 text-center text-sm font-semibold">
                    {t("priceCalendar.nights", { count: daysBetween(draft.checkIn!, draft.checkOut!) })}
                  </p>
                  {!valid ? (
                    <p role="alert" className="text-sm text-destructive">
                      {t("errors.dates_unavailable")}
                    </p>
                  ) : quote.isError ? (
                    <div className="grid gap-2">
                      <p role="alert" className="text-sm">
                        {t("pricing.quoteError")}
                      </p>
                      <Button variant="soft" size="sm" onClick={() => void quote.refetch()}>
                        {t("pricing.retry")}
                      </Button>
                    </div>
                  ) : quote.data ? (
                    <>
                      <PriceBreakdown
                        pricePerNight={listing.price_per_night}
                        cleaningFee={listing.cleaning_fee}
                        currency={listing.currency}
                        checkIn={draft.checkIn!}
                        checkOut={draft.checkOut!}
                        quote={quote.data}
                      />
                      {quote.isFetching ? (
                        <p role="status" className="text-xs text-muted-foreground">
                          {t("pricing.loading")}
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <p role="status" className="text-sm text-muted-foreground">
                      {t("pricing.loading")}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm leading-7 text-muted-foreground">
                  {draft.checkIn ? t("dates.chooseCheckOut") : t("listing.chooseCheckIn")}
                </p>
              )}
            </div>
            <Button
              disabled={!clearing && (!valid || !quote.data || quote.isFetching || quote.isError)}
              onClick={() => {
                setDates(draft);
                onConfirm?.();
                setOpen(false);
              }}
            >
              {t("priceCalendar.confirm")}
            </Button>
            <Button variant="ghost" size="sm" disabled={!draft.checkIn} onClick={() => setDraft({})}>
              {t("dates.clear")}
            </Button>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
