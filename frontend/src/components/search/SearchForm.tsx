"use client";

import { SearchIcon } from "lucide-react";
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
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-full border bg-card px-4 py-3 text-start shadow-lg shadow-foreground/10 md:hidden"
          >
            <SearchIcon className="size-5 shrink-0" aria-hidden />
            <span className="grid">
              <span className="font-bold">{props.initialCity?.label ?? t("home.whereTo")}</span>
              <span className="text-xs text-muted-foreground">{t("home.anyWhereAnyWhen")}</span>
            </span>
          </button>
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
          : // The pill: one rounded white bar; the fields lose their own borders and are split by sand lines.
            "grid grid-cols-[2fr_2fr_1.5fr_auto] items-center gap-0 rounded-full border bg-card p-2 shadow-lg shadow-foreground/10 [&_input]:border-0 [&_input]:bg-transparent [&>div]:px-5 [&>div:not(:nth-last-child(2))]:border-e [&_button[aria-haspopup]]:border-0 [&_button[aria-haspopup]]:bg-transparent [&_button[aria-haspopup]]:shadow-none",
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
        <span className="text-sm font-medium">{t("when")}</span>
        <DateRangePicker value={dates} onChange={setDates} min={today} />
      </div>
      <GuestPicker value={guests} onChange={setGuests} />
      <Button
        type="submit"
        size="lg"
        className={
          stacked
            ? undefined
            : "size-14 rounded-full bg-linear-to-b from-copper to-primary p-0 text-primary-foreground hover:opacity-90"
        }
      >
        <SearchIcon className={stacked ? undefined : "size-6"} />
        <span className={stacked ? undefined : "sr-only"}>{t("submit")}</span>
      </Button>
    </form>
  );
}
