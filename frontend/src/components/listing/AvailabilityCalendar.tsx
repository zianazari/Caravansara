"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { canCheckIn, canCheckOut } from "@/lib/availability";
import {
  addDays,
  calendarOf,
  daysBetween,
  formatDate,
  formatDay,
  formatMonth,
  monthGrid,
  monthOf,
  shiftMonth,
} from "@/lib/calendar";
import { cn } from "@/lib/cn";
import { useStayDates } from "./StayDates";

/**
 * The listing's calendar (feature 019, owner's request with a reference picture): two months side by side
 * (one on a phone), taken nights struck through, and the stay chosen right here, shared with the booking box.
 * A stay never crosses a taken night; leaving on the morning a booking starts is allowed. Persian pages show
 * the Solar Hijri calendar. Arrow keys move by a day or a week, as in the search's date picker.
 */
export function AvailabilityCalendar({ city }: { city: string }) {
  const t = useTranslations();
  const locale = useLocale();
  const calendar = calendarOf(locale);
  const rtl = locale === "fa";
  const { dates, setDates, booked, today } = useStayDates();
  const first = monthOf(calendar, today);
  const [month, setMonth] = useState(() => monthOf(calendar, dates.checkIn ?? today));
  const [focused, setFocused] = useState(dates.checkIn ?? today);
  const box = useRef<HTMLDivElement>(null);
  const max = addDays(today, 365);
  const choosingOut = Boolean(dates.checkIn && !dates.checkOut);

  const selectable = (iso: string) =>
    iso <= max &&
    (choosingOut
      ? canCheckOut(dates.checkIn!, iso, booked) || canCheckIn(iso, booked, today)
      : canCheckIn(iso, booked, today));

  function pick(iso: string) {
    if (choosingOut && canCheckOut(dates.checkIn!, iso, booked))
      setDates({ checkIn: dates.checkIn, checkOut: iso });
    else if (canCheckIn(iso, booked, today)) setDates({ checkIn: iso, checkOut: undefined });
  }

  function onKey(event: KeyboardEvent<HTMLDivElement>) {
    const step: Record<string, number> = {
      [rtl ? "ArrowLeft" : "ArrowRight"]: 1,
      [rtl ? "ArrowRight" : "ArrowLeft"]: -1,
      ArrowDown: 7,
      ArrowUp: -7,
    };
    if (event.key in step) {
      event.preventDefault();
      const next = addDays(focused, step[event.key]!);
      if (next < today || next > max) return;
      setFocused(next);
      const shown = [month, shiftMonth(month.year, month.month, 1)];
      const target = monthOf(calendar, next);
      if (!shown.some((m) => m.year === target.year && m.month === target.month)) setMonth(target);
      requestAnimationFrame(() =>
        box.current?.querySelector<HTMLButtonElement>(`[data-date="${next}"]`)?.focus(),
      );
    }
  }

  const nights = dates.checkIn && dates.checkOut ? daysBetween(dates.checkIn, dates.checkOut) : 0;
  const atFirst = month.year === first.year && month.month === first.month;
  const Prev = rtl ? ChevronRightIcon : ChevronLeftIcon;
  const Next = rtl ? ChevronLeftIcon : ChevronRightIcon;

  return (
    <section aria-labelledby="calendar-title" className="grid gap-4">
      <div>
        <h2 id="calendar-title" className="text-xl font-semibold">
          {nights
            ? t("listing.nightsIn", { count: nights, city })
            : choosingOut
              ? t("dates.chooseCheckOut")
              : t("listing.chooseCheckIn")}
        </h2>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {dates.checkIn && dates.checkOut
            ? `${formatDate(dates.checkIn, locale)} – ${formatDate(dates.checkOut, locale)}`
            : t("listing.calendarHint")}
        </p>
      </div>
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("dates.previousMonth")}
          disabled={atFirst}
          onClick={() => setMonth(shiftMonth(month.year, month.month, -1))}
        >
          <Prev />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("dates.nextMonth")}
          onClick={() => setMonth(shiftMonth(month.year, month.month, 1))}
        >
          <Next />
        </Button>
      </div>
      <div ref={box} onKeyDown={onKey} className="grid gap-8 md:grid-cols-2">
        {[month, shiftMonth(month.year, month.month, 1)].map((m, index) => {
          const weeks = monthGrid(calendar, m.year, m.month);
          const dayNames = weeks[1]!.map((iso) =>
            new Intl.DateTimeFormat(locale === "fa" ? "fa-IR" : "en-GB", {
              weekday: "narrow",
              timeZone: "UTC",
            }).format(new Date(`${iso}T00:00:00Z`)),
          );
          const title = formatMonth(calendar, m.year, m.month, locale);
          return (
            <div
              key={`${m.year}-${m.month}`}
              className={cn("grid content-start gap-2", index === 1 && "hidden md:grid")}
            >
              <p className="text-center font-semibold">{title}</p>
              <div role="grid" aria-label={title} className="grid gap-1">
                <div role="row" className="grid grid-cols-7 text-center text-xs text-muted-foreground">
                  {dayNames.map((name, i) => (
                    <span role="columnheader" key={i}>
                      {name}
                    </span>
                  ))}
                </div>
                {weeks.map((week, w) => (
                  <div role="row" key={w} className="grid grid-cols-7">
                    {week.map((iso, d) => {
                      if (!iso) return <span role="gridcell" key={`blank-${d}`} />;
                      const taken = booked.has(iso);
                      const ends = iso === dates.checkIn || iso === dates.checkOut;
                      const inside = Boolean(
                        dates.checkIn && dates.checkOut && iso > dates.checkIn && iso < dates.checkOut,
                      );
                      return (
                        <span
                          role="gridcell"
                          key={iso}
                          aria-selected={ends || inside}
                          className={cn(
                            inside && "bg-muted",
                            iso === dates.checkIn &&
                              dates.checkOut &&
                              "bg-muted ltr:rounded-l-full rtl:rounded-r-full",
                            iso === dates.checkOut && "bg-muted ltr:rounded-r-full rtl:rounded-l-full",
                          )}
                        >
                          <button
                            type="button"
                            data-date={iso}
                            tabIndex={iso === focused ? 0 : -1}
                            disabled={!selectable(iso)}
                            aria-label={`${formatDate(iso, locale, "long")}${taken ? `${locale === "fa" ? "، " : ", "}${t("listing.taken")}` : ""}`}
                            onClick={() => {
                              setFocused(iso);
                              pick(iso);
                            }}
                            className={cn(
                              "mx-auto grid size-10 place-content-center rounded-full text-sm hover:ring-1 hover:ring-foreground disabled:text-muted-foreground/50 disabled:hover:ring-0",
                              taken && "line-through",
                              ends && "bg-foreground text-background hover:ring-0",
                            )}
                          >
                            {formatDay(iso, locale)}
                          </button>
                        </span>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-end">
        <Button variant="link" size="sm" onClick={() => setDates({})} disabled={!dates.checkIn}>
          {t("dates.clear")}
        </Button>
      </div>
    </section>
  );
}
