"use client";

import { useQuery } from "@tanstack/react-query";
import { MapPinIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { api } from "@/api/client";
import { cityName, countryName } from "@/lib/names";
import { hasPersian, persianCityMatches } from "@/lib/persianCitySearch";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

/** A chosen city; `country` is its ISO code, which the host's form uses to start the currency (008, R7). */
export type CityChoice = { id: number; label: string; country?: string };

type City = { id: number; name: string; country: { code: string } };

/** How many popular cities an empty field suggests (feature 030). */
const POPULAR_COUNT = 6;
/** The country whose cities come first among the popular ones, by the page's language (feature 030). */
const HOME_COUNTRY: Record<string, string> = { fa: "IR" };

/**
 * The most booked cities (GET /cities?sort=popular), with the language's own country first: on the Persian site,
 * Tehran, Isfahan and Shiraz come before the rest, which is what a visitor from Iran looks for first.
 */
async function popularCities(home?: string): Promise<City[]> {
  const get = async (country?: string) => {
    const query = { sort: "popular" as const, limit: POPULAR_COUNT, ...(country ? { country } : {}) };
    const { data } = await api.GET("/api/v1/cities", { params: { query } });
    return data ?? [];
  };
  const [first, all] = await Promise.all([home ? get(home) : Promise.resolve([]), get()]);
  const seen = new Set(first.map((city) => city.id));
  return [...first, ...all.filter((city) => !seen.has(city.id))].slice(0, POPULAR_COUNT);
}

/**
 * City with suggestions from GET /cities?q= (US1/AC1). A combobox in the ARIA pattern: type, move with the
 * arrow keys, choose with Enter. Names are shown in the page's language.
 *
 * Persian typing (feature 028): the API matches English names only, so «تهر» is first matched against the
 * Persian names here (lib/persianCitySearch) and each match is fetched by its English name.
 *
 * An empty field (feature 030) suggests the popular cities, so a visitor can choose without typing.
 *
 * Built on shadcn/ui Command (cmdk, feature 026), which runs the keyboard and the active item. The server
 * filters, so cmdk's own filter is off (shouldFilter={false}). cmdk names the box from its `label`, so the
 * visible caption is only a picture of it that focuses the box.
 */
export function CityCombobox({
  value,
  onChange,
  label,
  invalid,
  describedBy,
}: {
  value?: CityChoice;
  onChange: (city?: CityChoice) => void;
  /** The field's name; search's "Where" when not given. */
  label?: string;
  invalid?: boolean;
  describedBy?: string;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const input = useRef<HTMLInputElement>(null);
  // The list closes a moment after the box loses focus, so a click on an item lands first. The timer is
  // cleared when the field goes away, so it never updates a field that is no longer on the page.
  const closing = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(closing.current), []);
  const [text, setText] = useState(value?.label ?? "");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  // A new chosen city from outside (another search) replaces the typed text, during render, not in an effect.
  const [shownLabel, setShownLabel] = useState(value?.label);
  if (value?.label !== shownLabel) {
    setShownLabel(value?.label);
    setText(value?.label ?? "");
  }
  useEffect(() => {
    const timer = setTimeout(() => setQuery(text.trim()), 200);
    return () => clearTimeout(timer);
  }, [text]);

  const empty = text.trim().length === 0;
  const home = HOME_COUNTRY[locale];
  const popular = useQuery({
    queryKey: ["cities", "popular", home ?? null],
    enabled: open && empty,
    staleTime: 10 * 60 * 1000, // the API counts them again every 10 minutes
    queryFn: () => popularCities(home),
  });
  const cities = useQuery({
    queryKey: ["cities", query],
    enabled: open && !empty && query.length > 0,
    queryFn: async () => {
      if (!hasPersian(query)) {
        const { data } = await api.GET("/api/v1/cities", { params: { query: { q: query, limit: 8 } } });
        return data ?? [];
      }
      // One request per matching city; the API's prefix search may also return longer names, so keep the exact one.
      const found = await Promise.all(
        persianCityMatches(query).map(async (name) => {
          const { data } = await api.GET("/api/v1/cities", { params: { query: { q: name, limit: 8 } } });
          return (data ?? []).filter((city) => city.name === name);
        }),
      );
      return found.flat();
    },
  });
  const options = ((empty ? popular.data : cities.data) ?? []).map((c) => ({
    id: c.id,
    label: cityName(t, c.name),
    code: c.country.code,
    country: countryName(c.country.code, locale),
  }));

  function choose(option: (typeof options)[number]) {
    onChange({ id: option.id, label: option.label, country: option.code });
    setText(option.label);
    setOpen(false);
  }

  const name = label ?? t("search.where");
  const showList = open && (empty ? options.length > 0 : query.length > 0);
  return (
    <Command
      shouldFilter={false}
      label={name}
      loop={false}
      className="relative grid gap-1.5 overflow-visible"
    >
      <span aria-hidden className="text-sm font-medium" onClick={() => input.current?.focus()}>
        {name}
      </span>
      <div className="relative">
        <MapPinIcon className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <CommandInput
          ref={input}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          placeholder={t("search.wherePlaceholder")}
          value={text}
          onValueChange={(next) => {
            setText(next);
            setOpen(true);
            if (value) onChange(undefined);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            clearTimeout(closing.current);
            closing.current = setTimeout(() => setOpen(false), 150);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
            else if (event.key === "ArrowDown") setOpen(true);
          }}
          className="ps-9"
        />
      </div>
      <CommandList
        label={empty ? t("search.popularCities") : name}
        hidden={!showList}
        // Keep the focus in the box while an item is clicked, so the list does not close first.
        onMouseDown={(event) => event.preventDefault()}
        className="absolute top-full z-40 mt-1 w-full rounded-lg border bg-card shadow-lg"
      >
        {showList && empty ? (
          <CommandGroup heading={t("search.popularCities")}>
            {options.map((option) => (
              <CommandItem
                key={option.id}
                value={String(option.id)}
                onSelect={() => choose(option)}
                className="justify-between"
              >
                <span>{option.label}</span>
                <span className="text-sm text-muted-foreground">{option.country}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
        {showList && !empty
          ? options.map((option) => (
              <CommandItem
                key={option.id}
                value={String(option.id)}
                onSelect={() => choose(option)}
                className="justify-between"
              >
                <span>{option.label}</span>
                <span className="text-sm text-muted-foreground">{option.country}</span>
              </CommandItem>
            ))
          : null}
        {showList && !empty && cities.isSuccess && options.length === 0 ? (
          <CommandEmpty>{t("search.noCities")}</CommandEmpty>
        ) : null}
      </CommandList>
    </Command>
  );
}
