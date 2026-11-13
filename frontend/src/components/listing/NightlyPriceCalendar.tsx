"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { useMoney } from "@/hooks/useMoney";
import { usePriceQuote } from "@/hooks/usePriceQuote";
import { canCheckIn, canCheckOut } from "@/lib/availability";
import {
  addDays,
  calendarOf,
  formatDate,
  formatDay,
  formatMonth,
  monthGrid,
  monthOf,
  shiftMonth,
} from "@/lib/calendar";
import { calendarPriceUnit, formatCalendarPrice } from "@/lib/calendarPrice";
import { cn } from "@/lib/cn";
import type { StayRange } from "./StayDates";

export type CalendarListing = { id: number; price_per_night: string; currency: string; countryCode?: string };

/** The same server-priced, keyboard-accessible calendar in the page and booking dialog. */
export function NightlyPriceCalendar({
  listing,
  value,
  onChange,
  booked,
  today,
  months = 1,
}: {
  listing: CalendarListing;
  value: StayRange;
  onChange: (range: StayRange) => void;
  booked: ReadonlySet<string>;
  today: string;
  months?: 1 | 2;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const calendar = calendarOf(locale);
  const money = useMoney();
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const max = addDays(today, 365);
  const initial = value.checkIn && value.checkIn >= today && value.checkIn <= max ? value.checkIn : today;
  const [month, setMonth] = useState(() => monthOf(calendar, initial));
  const [focused, setFocused] = useState(initial);
  const shown = months === 2 ? [month, shiftMonth(month.year, month.month, 1)] : [month];
  const allDays = shown
    .flatMap((m) => monthGrid(calendar, m.year, m.month).flat())
    .filter((d): d is string => d !== null);
  const start = allDays[0]! < today ? today : allDays[0]!;
  const last = allDays[allDays.length - 1]! > max ? max : allDays[allDays.length - 1]!;
  const quote = usePriceQuote(listing.id, start, addDays(last, 1));
  const byDay = new Map(quote.data?.nights.map((n) => [n.date, n]));
  const unit = calendarPriceUnit(listing.price_per_night, listing.currency);
  const unitLabel = listing.currency === "IRR" ? t(`priceCalendar.${unit}`) : listing.currency;
  const choosingOut = Boolean(value.checkIn && !value.checkOut);
  const canIn = (iso: string) => iso >= today && iso <= max && canCheckIn(iso, booked, today);
  const canOut = (iso: string) =>
    choosingOut && iso >= today && iso <= max && canCheckOut(value.checkIn!, iso, booked);
  const tabbable =
    allDays.includes(focused) && (canIn(focused) || canOut(focused))
      ? focused
      : allDays.find((iso) => canIn(iso) || canOut(iso));

  function pick(iso: string) {
    if (canOut(iso)) onChange({ checkIn: value.checkIn, checkOut: iso });
    else if (canIn(iso)) onChange({ checkIn: iso });
  }

  function move(iso: string) {
    let target = iso < today ? today : iso > max ? max : iso;
    const direction = target >= focused ? 1 : -1;
    while (!canIn(target) && !canOut(target)) {
      target = addDays(target, direction);
      if (target < today || target > max) return;
    }
    setFocused(target);
    const targetMonth = monthOf(calendar, target);
    if (!shown.some((m) => m.year === targetMonth.year && m.month === targetMonth.month))
      setMonth(targetMonth);
    requestAnimationFrame(() =>
      box.current?.querySelector<HTMLButtonElement>(`[data-date="${target}"]`)?.focus(),
    );
  }

  function onKey(event: KeyboardEvent<HTMLDivElement>) {
    const weekday = new Date(`${focused}T00:00:00Z`).getUTCDay();
    const intoWeek = (weekday - (calendar === "jalali" ? 6 : 1) + 7) % 7;
    const step: Record<string, number> = {
      [locale === "fa" ? "ArrowLeft" : "ArrowRight"]: 1,
      [locale === "fa" ? "ArrowRight" : "ArrowLeft"]: -1,
      ArrowDown: 7,
      ArrowUp: -7,
      Home: -intoWeek,
      End: 6 - intoWeek,
    };
    if (event.key in step) {
      event.preventDefault();
      move(addDays(focused, step[event.key]!));
    } else if (event.key === "PageUp" || event.key === "PageDown") {
      event.preventDefault();
      const next = shiftMonth(
        monthOf(calendar, focused).year,
        monthOf(calendar, focused).month,
        event.key === "PageUp" ? -1 : 1,
      );
      const days = monthGrid(calendar, next.year, next.month)
        .flat()
        .filter((d): d is string => d !== null);
      // Calendar day numbers must follow the selected calendar, including leap/month boundaries.
      const currentDays = monthGrid(
        calendar,
        monthOf(calendar, focused).year,
        monthOf(calendar, focused).month,
      )
        .flat()
        .filter((d): d is string => d !== null);
      move(days[Math.min(currentDays.indexOf(focused), days.length - 1)]!);
    }
  }

  const firstMonth = monthOf(calendar, today);
  const lastMonth = monthOf(calendar, max);
  const atFirst = month.year === firstMonth.year && month.month === firstMonth.month;
  const atLast = month.year === lastMonth.year && month.month === lastMonth.month;
  const Prev = locale === "fa" ? ChevronRightIcon : ChevronLeftIcon;
  const Next = locale === "fa" ? ChevronLeftIcon : ChevronRightIcon;

  return (
    <div className="grid min-w-0 gap-4" data-nightly-calendar>
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("dates.previousMonth")}
          disabled={atFirst}
          onClick={() => {
            const next = shiftMonth(month.year, month.month, -1);
            setMonth(next);
            setFocused(
              monthGrid(calendar, next.year, next.month)
                .flat()
                .find((d) => d && d >= today) ?? today,
            );
          }}
        >
          <Prev />
        </Button>
        <p className="min-w-0 text-center text-xs leading-6 text-muted-foreground sm:text-sm">
          {t("priceCalendar.perNight", { unit: unitLabel })}
        </p>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("dates.nextMonth")}
          disabled={atLast}
          onClick={() => {
            const next = shiftMonth(month.year, month.month, 1);
            setMonth(next);
            setFocused(
              monthGrid(calendar, next.year, next.month)
                .flat()
                .find((d) => d && d <= max) ?? max,
            );
          }}
        >
          <Next />
        </Button>
      </div>
      {quote.isError ? (
        <div className="grid gap-2 rounded-xl border p-3">
          <p role="alert" className="text-sm">
            {t("pricing.quoteError")}
          </p>
          <Button variant="soft" size="sm" onClick={() => void quote.refetch()}>
            {t("pricing.retry")}
          </Button>
        </div>
      ) : quote.isPending ? (
        <p role="status" className="text-xs text-muted-foreground">
          {t("pricing.loading")}
        </p>
      ) : null}
      <div ref={box} className={cn("grid min-w-0 gap-6", months === 2 && "md:grid-cols-2")}>
        {shown.map((m, index) => {
          const weeks = monthGrid(calendar, m.year, m.month);
          const title = formatMonth(calendar, m.year, m.month, locale);
          return (
            <div
              key={`${m.year}-${m.month}`}
              className={cn("grid min-w-0 content-start gap-3", index === 1 && "hidden md:grid")}
            >
              <p className="text-center font-semibold" aria-live="polite">
                {title}
              </p>
              <div role="grid" aria-label={title} className="grid gap-1" onKeyDown={onKey}>
                <div role="row" className="grid grid-cols-7 text-center text-xs text-muted-foreground">
                  {weeks[1]!.map((iso, i) => (
                    <span role="columnheader" key={i}>
                      {new Intl.DateTimeFormat(locale === "fa" ? "fa-IR" : "en-GB", {
                        weekday: "narrow",
                        timeZone: "UTC",
                      }).format(new Date(`${iso}T00:00:00Z`))}
                    </span>
                  ))}
                </div>
                {weeks.map((week, w) => (
                  <div role="row" key={w} className="grid grid-cols-7 gap-px">
                    {week.map((iso, d) => {
                      if (!iso) return <span role="gridcell" key={`blank-${d}`} />;
                      const taken = booked.has(iso);
                      const checkout = iso === value.checkOut;
                      const ends = iso === value.checkIn || checkout;
                      const inside = Boolean(
                        value.checkIn && value.checkOut && iso > value.checkIn && iso < value.checkOut,
                      );
                      const night = byDay.get(iso);
                      const weekday = new Date(`${iso}T00:00:00Z`).getUTCDay();
                      const iranianWeekend = listing.countryCode === "IR" && (weekday === 4 || weekday === 5);
                      const priced = !taken && iso >= today && iso <= max && night;
                      const dayLabel = formatDay(iso, locale);
                      const priceLabel = checkout
                        ? t("booking.checkOut")
                        : taken || iso < today || iso > max
                          ? "—"
                          : priced
                            ? formatCalendarPrice(
                                night.amount,
                                listing.price_per_night,
                                listing.currency,
                                locale,
                              )
                            : quote.isError
                              ? "—"
                              : "…";
                      const description = checkout
                        ? t("priceCalendar.checkoutNote")
                        : taken
                          ? t("listing.taken")
                          : priced
                            ? `${money(night.amount, listing.currency)} · ${t(`pricing.source_${night.source}`)}${night.label ? ` · ${night.label}` : ""}${iranianWeekend && night.source !== "weekend" ? ` · ${t("pricing.source_weekend")}` : ""}`
                            : "";
                      return (
                        <span
                          role="gridcell"
                          key={iso}
                          aria-selected={ends || inside}
                          className={cn(
                            "min-w-0",
                            inside && "bg-primary/10",
                            ends && value.checkOut && "rounded-lg bg-primary/10",
                          )}
                        >
                          <button
                            type="button"
                            data-date={iso}
                            data-price-source={priced ? night.source : undefined}
                            data-weekend={iranianWeekend || night?.source === "weekend" ? true : undefined}
                            tabIndex={iso === tabbable ? 0 : -1}
                            onFocus={() => setFocused(iso)}
                            disabled={!canIn(iso) && !canOut(iso)}
                            aria-label={`${dayLabel} ${priceLabel} · ${formatDate(iso, locale, "long")}${taken ? `${locale === "fa" ? "، " : ", "}${t("listing.taken")}` : ""}`}
                            aria-describedby={description ? `${id}-${iso}` : undefined}
                            title={`${formatDate(iso, locale)}${description ? ` · ${description}` : ""}`}
                            onClick={() => {
                              setFocused(iso);
                              pick(iso);
                            }}
                            className={cn(
                              "relative grid min-h-16 w-full min-w-0 content-center justify-items-center gap-1 rounded-lg px-0.5 py-2 text-sm transition-colors hover:bg-primary/10 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring disabled:text-muted-foreground/45 disabled:hover:bg-transparent sm:min-h-18",
                              taken && !checkout && "line-through",
                              ends &&
                                "bg-primary text-primary-foreground hover:bg-primary disabled:bg-primary disabled:text-primary-foreground disabled:hover:bg-primary",
                            )}
                          >
                            <span className="text-base font-semibold">{dayLabel}</span>{" "}
                            <span
                              aria-hidden
                              data-day-price
                              className={cn(
                                "max-w-full text-[10px] leading-4 tabular-nums sm:text-xs",
                                !ends && "text-muted-foreground",
                                !ends &&
                                  priced &&
                                  (iranianWeekend ||
                                    night.source === "weekend" ||
                                    night.source === "custom") &&
                                  "text-primary",
                              )}
                            >
                              <bdi>{priceLabel}</bdi>
                            </span>
                            {!ends && priced && night.source === "holiday" ? (
                              <span
                                className="absolute end-1 top-1 size-1.5 rounded-full bg-gold"
                                aria-hidden
                              />
                            ) : null}
                          </button>
                          {description ? (
                            <span id={`${id}-${iso}`} className="sr-only">
                              {description}
                            </span>
                          ) : null}
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
      <div className="flex flex-wrap gap-x-4 gap-y-2 border-t pt-3 text-xs text-muted-foreground">
        {(["base", "weekend", "holiday", "custom"] as const).map((source) => (
          <span key={source} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className={cn(
                "size-1.5 rounded-full",
                source === "holiday" ? "bg-gold" : source === "base" ? "bg-muted-foreground" : "bg-primary",
              )}
            />
            {t(`pricing.source_${source}`)}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="text-muted-foreground/70">
            ×
          </span>
          {t("listing.taken")}
        </span>
      </div>
      <p className="text-xs leading-6 text-muted-foreground">{t("priceCalendar.compactHint")}</p>
    </div>
  );
}
