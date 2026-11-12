"use client";

import { CalendarDaysIcon, SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { DateRangePicker } from "@/components/date/DateRangePicker";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { type SearchState, toQuery } from "@/lib/searchParams";
import { CityCombobox, type CityChoice } from "./CityCombobox";
import { GuestPicker } from "./GuestPicker";

type Props = {
  initial?: Partial<SearchState>;
  initialCity?: CityChoice;
  /** Today's date, the first day that can be chosen. */
  today: string;
  className?: string;
};

/**
 * Where, when and who (US1). A city search starts here; a radius search starts from the map ("search this
 * area"). Submitting opens /search with everything in the address (FR-020).
 *
 * Caravansara theme (specs/007-caravansara-theme, FR-005): from md up a white pill with the fields side by side
 * and a round copper button, like the booking sites people know; on a phone one line, "Where to?", that opens
 * the same fields in a dialog. Both are the same form, so behaviour and field names stay those of 005.
 */
export function SearchForm({ className, ...props }: Props) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  return (
    <div className={className}>
      <SearchFields {...props} className="hidden md:grid" />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="home-search-mobile h-auto w-full justify-start gap-3 rounded-full px-4 py-3 text-start font-normal whitespace-normal shadow-lg shadow-foreground/10 hover:bg-card md:hidden [&_svg]:size-5"
          >
            <SearchIcon aria-hidden />
            <span className="grid">
              <span className="font-bold">{props.initialCity?.label ?? t("home.whereTo")}</span>
              <span className="text-xs text-muted-foreground">{t("home.anyWhereAnyWhen")}</span>
            </span>
          </Button>
        </DialogTrigger>
        <DialogContent side="bottom" closeLabel={t("common.close")}>
          <DialogTitle>{t("home.whereTo")}</DialogTitle>
          <SearchFields {...props} stacked onDone={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SearchFields({
  initial,
  initialCity,
  today,
  className,
  stacked,
  onDone,
}: Props & { stacked?: boolean; onDone?: () => void }) {
  const t = useTranslations("search");
  const router = useRouter();
  const [city, setCity] = useState<CityChoice | undefined>(initialCity);
  const [dates, setDates] = useState<{ checkIn?: string; checkOut?: string }>({
    checkIn: initial?.check_in,
    checkOut: initial?.check_out,
  });
  const [guests, setGuests] = useState({
    adults: initial?.adults ?? 1,
    children: initial?.children ?? 0,
    infants: initial?.infants ?? 0,
    pets: initial?.pets ?? 0,
  });
  const [error, setError] = useState<string>();
  const radius =
    !city && initial?.lat !== undefined
      ? { lat: initial.lat, lng: initial.lng, radius_km: initial.radius_km }
      : {};

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!city && radius.lat === undefined) {
      setError(t("needArea"));
      return;
    }
    setError(undefined);
    const state: SearchState = {
      ...(city ? { city_id: city.id } : radius),
      check_in: dates.checkIn && dates.checkOut ? dates.checkIn : undefined,
      check_out: dates.checkIn && dates.checkOut ? dates.checkOut : undefined,
      ...guests,
      amenity_ids: initial?.amenity_ids ?? [],
      sort: "rating",
      offset: 0,
    };
    onDone?.();
    router.push(`/search?${toQuery(state).toString()}`);
  }

  return (
    <form
      onSubmit={submit}
      role="search"
      className={cn(
        stacked
          ? "grid gap-4"
          : // The pill: one rounded white bar; the fields lose their own borders and hover colours, and the
            // sections are split by sand lines and light up under the pointer (.search-pill in globals.css, 033).
            // Feature 039 (owner's reference): larger titles (17 px, semibold) and values (16 px) in the pill.
            "search-pill grid grid-cols-[2fr_2fr_1.5fr_auto] items-center gap-0 rounded-full border p-2 shadow-lg shadow-foreground/10 [&_.field-label]:text-[1.0625rem] [&_.field-label]:font-semibold [&_button[aria-haspopup]]:text-base [&_input]:text-base [&_input]:ps-3 [&_input]:border-0 [&_input]:bg-transparent [&_button[aria-haspopup]]:border-0 [&_button[aria-haspopup]]:bg-transparent [&_button[aria-haspopup]]:shadow-none [&_button[aria-haspopup]]:hover:bg-transparent [&_button[aria-haspopup]]:hover:shadow-none",
        className,
      )}
    >
      <div>
        <CityCombobox value={city} onChange={setCity} />
        {error ? (
          <p role="alert" className="mt-1 text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>
      <div className="grid gap-1.5">
        <span className="field-label inline-flex items-center gap-2 text-sm font-medium">
          <CalendarDaysIcon aria-hidden className="field-icon" />
          {t("when")}
        </span>
        <DateRangePicker value={dates} onChange={setDates} min={today} />
      </div>
      <GuestPicker value={guests} onChange={setGuests} />
      <Button
        type="submit"
        size="lg"
        className={
          stacked
            ? undefined
            : "size-16 rounded-full bg-linear-to-b from-copper to-primary p-0 text-primary-foreground hover:opacity-90 [&_svg]:size-7"
        }
      >
        <SearchIcon />
        <span className={stacked ? undefined : "sr-only"}>{t("submit")}</span>
      </Button>
    </form>
  );
}
