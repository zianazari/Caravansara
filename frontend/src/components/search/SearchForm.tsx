"use client";

import { SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { DateRangePicker } from "@/components/date/DateRangePicker";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { type SearchState, toQuery } from "@/lib/searchParams";
import { CityCombobox, type CityChoice } from "./CityCombobox";
import { GuestPicker } from "./GuestPicker";

/**
 * Where, when and who (US1). A city search starts here; a radius search starts from the map ("search this
 * area"). Submitting opens /search with everything in the address (FR-020).
 */
export function SearchForm({
  initial,
  initialCity,
  today,
}: {
  initial?: Partial<SearchState>;
  initialCity?: CityChoice;
  /** Today's date, the first day that can be chosen. */
  today: string;
}) {
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
    router.push(`/search?${toQuery(state).toString()}`);
  }

  return (
    <form
      onSubmit={submit}
      role="search"
      className="grid gap-3 rounded-xl border bg-card p-4 shadow-sm md:grid-cols-[2fr_2fr_1.5fr_auto] md:items-end"
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
      <Button type="submit" size="lg">
        <SearchIcon />
        {t("submit")}
      </Button>
    </form>
  );
}
