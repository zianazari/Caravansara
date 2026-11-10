"use client";

import { useQuery } from "@tanstack/react-query";
import { MapPinIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useState, type KeyboardEvent } from "react";
import { api } from "@/api/client";
import { cityName, countryName } from "@/lib/names";
import { cn } from "@/lib/cn";

/** A chosen city; `country` is its ISO code, which the host's form uses to start the currency (008, R7). */
export type CityChoice = { id: number; label: string; country?: string };

/**
 * City with suggestions from GET /cities?q= (US1/AC1). A combobox in the ARIA pattern: type, move with the
 * arrow keys, choose with Enter. Names are shown in the page's language.
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

  const cities = useQuery({
    queryKey: ["cities", query],
    enabled: open && query.length > 0,
    queryFn: async () => {
      const { data } = await api.GET("/api/v1/cities", { params: { query: { q: query, limit: 8 } } });
      return data ?? [];
    },
  });
  const options = (cities.data ?? []).map((c) => ({
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
  const showList = open && query.length > 0;
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
        aria-label={label ?? t("search.where")}
        hidden={!showList}
        className="absolute top-full z-40 mt-1 w-full overflow-hidden rounded-lg border bg-card shadow-lg"
      >
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
        {cities.isSuccess && options.length === 0 ? (
          <li role="option" aria-selected={false} aria-disabled className="px-3 py-2.5 text-muted-foreground">
            {t("search.noCities")}
          </li>
        ) : null}
      </ul>
    </div>
  );
}
