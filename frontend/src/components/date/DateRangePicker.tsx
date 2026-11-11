"use client";

import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { cn } from "@/lib/cn";

type Range = { checkIn?: string; checkOut?: string };

/**
 * Check-in and check-out dates (FR-005, research R8). Persian pages show the Jalali calendar, English pages
 * the Gregorian one; the value is always a Gregorian YYYY-MM-DD. The grid works with the keyboard: arrows move
 * by a day or a week (left and right follow the reading direction), Home and End go to the week's ends, and
 * Page Up and Page Down change the month.
 */
export function DateRangePicker({
  value,
  onChange,
  min,
  maxDaysAhead = 365,
  label,
  booked,
}: {
  value: Range;
  onChange: (range: Range) => void;
  min: string;
  maxDaysAhead?: number;
  label?: string;
  /** A listing's taken nights (feature 019): struck through, and no stay may cross one. */
  booked?: ReadonlySet<string>;
}) {
  const t = useTranslations("dates");
  const locale = useLocale();
  const calendar = calendarOf(locale);
  const rtl = locale === "fa";
  const max = addDays(min, maxDaysAhead);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(value.checkIn ?? min);
  const [month, setMonth] = useState(() => monthOf(calendar, value.checkIn ?? min));
  const grid = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    grid.current?.querySelector<HTMLButtonElement>(`[data-date="${focused}"]`)?.focus();
  }, [open, focused, month]);

  const taken = booked ?? new Set<string>();
  const choosingOut = Boolean(value.checkIn && !value.checkOut);
  const canIn = (iso: string) => iso >= min && iso <= max && canCheckIn(iso, taken, min);
  const canOut = (iso: string) => choosingOut && iso <= max && canCheckOut(value.checkIn!, iso, taken);
  const inRange = (iso: string) => canIn(iso) || canOut(iso);

  function pick(iso: string) {
    if (canOut(iso)) {
      onChange({ checkIn: value.checkIn, checkOut: iso });
      setOpen(false);
    } else if (canIn(iso)) {
      onChange({ checkIn: iso, checkOut: undefined });
    }
  }

  function moveTo(iso: string) {
    const target = iso < min ? min : iso > max ? max : iso;
    setFocused(target);
    setMonth(monthOf(calendar, target));
  }

  function onKey(event: KeyboardEvent<HTMLDivElement>) {
    const forward = rtl ? "ArrowLeft" : "ArrowRight";
    const backward = rtl ? "ArrowRight" : "ArrowLeft";
    const weekday = new Date(`${focused}T00:00:00Z`).getUTCDay();
    const weekStart = calendar === "jalali" ? 6 : 1;
    const intoWeek = (weekday - weekStart + 7) % 7;
    const moves: Record<string, () => string> = {
      [forward]: () => addDays(focused, 1),
      [backward]: () => addDays(focused, -1),
      ArrowDown: () => addDays(focused, 7),
      ArrowUp: () => addDays(focused, -7),
      Home: () => addDays(focused, -intoWeek),
      End: () => addDays(focused, 6 - intoWeek),
      PageDown: () => addDays(focused, 30),
      PageUp: () => addDays(focused, -30),
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      moveTo(move());
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      pick(focused);
    }
  }

  const weeks = monthGrid(calendar, month.year, month.month);
  const shown =
    value.checkIn && value.checkOut
      ? `${formatDate(value.checkIn, locale)} – ${formatDate(value.checkOut, locale)}`
      : value.checkIn
        ? `${formatDate(value.checkIn, locale)} – ${t("chooseCheckOut")}`
        : t("anyDates");
  const PrevIcon = rtl ? ChevronRightIcon : ChevronLeftIcon;
  const NextIcon = rtl ? ChevronLeftIcon : ChevronRightIcon;
  // The second week of a month is always full, so it gives the weekday of every column.
  const fullWeek = weeks[1]!;
  const dayNames = fullWeek.map((iso) =>
    new Intl.DateTimeFormat(locale === "fa" ? "fa-IR" : "en-GB", {
      weekday: "narrow",
      timeZone: "UTC",
    }).format(new Date(`${iso}T00:00:00Z`)),
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-start font-normal"
          aria-label={`${label ?? t("dates")}: ${shown}`}
        >
          <CalendarIcon />
          <span className="truncate">{shown}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(22rem,calc(100vw-2rem))]">
        <div className="mb-3 flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("previousMonth")}
            onClick={() => setMonth(shiftMonth(month.year, month.month, -1))}
          >
            <PrevIcon />
          </Button>
          <p className="font-medium" aria-live="polite">
            {formatMonth(calendar, month.year, month.month, locale)}
          </p>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("nextMonth")}
            onClick={() => setMonth(shiftMonth(month.year, month.month, 1))}
          >
            <NextIcon />
          </Button>
        </div>
        <div ref={grid} role="grid" aria-label={t("calendar")} onKeyDown={onKey} className="grid gap-1">
          <div role="row" className="grid grid-cols-7 text-center text-xs text-muted-foreground">
            {dayNames.map((name, i) => (
              <span role="columnheader" key={i}>
                {name}
              </span>
            ))}
          </div>
          {weeks.map((week, w) => (
            <div role="row" key={w} className="grid grid-cols-7 gap-1">
              {week.map((iso, d) =>
                iso ? (
                  <span
                    role="gridcell"
                    key={iso}
                    aria-selected={iso === value.checkIn || iso === value.checkOut}
                  >
                    <button
                      type="button"
                      data-date={iso}
                      tabIndex={iso === focused ? 0 : -1}
                      disabled={!inRange(iso)}
                      aria-label={formatDate(iso, locale, "long")}
                      onClick={() => {
                        setFocused(iso);
                        pick(iso);
                      }}
                      className={cn(
                        "grid size-10 w-full place-content-center rounded-md text-sm transition-[transform,background-color] duration-200 hover:scale-105 hover:bg-muted disabled:text-muted-foreground/40 disabled:hover:scale-100 disabled:hover:bg-transparent",
                        taken.has(iso) && "line-through",
                        value.checkIn &&
                          value.checkOut &&
                          iso > value.checkIn &&
                          iso < value.checkOut &&
                          "bg-accent",
                        (iso === value.checkIn || iso === value.checkOut) &&
                          "bg-primary text-primary-foreground hover:bg-primary",
                      )}
                    >
                      {formatDay(iso, locale)}
                    </button>
                  </span>
                ) : (
                  <span role="gridcell" key={`blank-${d}`} />
                ),
              )}
            </div>
          ))}
        </div>
        <div className="mt-3 flex justify-between">
          <Button variant="link" size="sm" onClick={() => onChange({})}>
            {t("clear")}
          </Button>
          <p className="text-sm text-muted-foreground">
            {value.checkIn && !value.checkOut ? t("chooseCheckOut") : ""}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
