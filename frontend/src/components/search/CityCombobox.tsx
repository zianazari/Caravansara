"use client";

import { useQuery } from "@tanstack/react-query";
import { MapPinIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useState, type KeyboardEvent } from "react";
import { api } from "@/api/client";
import { cityName, countryName } from "@/lib/names";
import { hasPersian, persianCityMatches } from "@/lib/persianCitySearch";
import { cn } from "@/lib/cn";

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
  const id = useId();
  const [text, setText] = useState(value?.label ?? "");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

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

  function choose(index: number) {
    const option = options[index];
    if (!option) return;
    onChange({ id: option.id, label: option.label, country: option.code });
    setText(option.label);
    setOpen(false);
  }

  function onKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(options.length - 1, i + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (event.key === "Enter" && open && options.length > 0) {
      event.preventDefault();
      choose(active);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  const listId = `${id}-list`;
  const showList = open && (empty ? options.length > 0 : query.length > 0);
  const listName = empty ? t("search.popularCities") : (label ?? t("search.where"));
  return (
    <div className="relative grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label ?? t("search.where")}
      </label>
      <div className="relative">
        <MapPinIcon className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          id={id}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && options[active] ? `${listId}-${active}` : undefined}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          autoComplete="off"
          placeholder={t("search.wherePlaceholder")}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setOpen(true);
            setActive(0);
            if (value) onChange(undefined);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKey}
          className="h-11 w-full rounded-lg border bg-card ps-9 pe-3 text-base"
        />
      </div>
      <ul
        id={listId}
        role="listbox"
        aria-label={listName}
        hidden={!showList}
        className="absolute top-full z-40 mt-1 w-full overflow-hidden rounded-lg border bg-card shadow-lg"
      >
        {empty ? (
          <li role="presentation" className="px-3 pt-2.5 pb-1 text-xs font-medium text-muted-foreground">
            {listName}
          </li>
        ) : null}
        {options.map((option, index) => (
          <li
            id={`${listId}-${index}`}
            key={option.id}
            role="option"
            aria-selected={index === active}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => choose(index)}
            className={cn("flex cursor-pointer justify-between px-3 py-2.5", index === active && "bg-muted")}
          >
            <span>{option.label}</span>
            <span className="text-sm text-muted-foreground">{option.country}</span>
          </li>
        ))}
        {!empty && cities.isSuccess && options.length === 0 ? (
          <li role="option" aria-selected={false} aria-disabled className="px-3 py-2.5 text-muted-foreground">
            {t("search.noCities")}
          </li>
        ) : null}
      </ul>
    </div>
  );
}
