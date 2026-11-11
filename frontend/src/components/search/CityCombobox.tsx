"use client";

import { useQuery } from "@tanstack/react-query";
import { MapPinIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { api } from "@/api/client";
import { cityName, countryName } from "@/lib/names";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

/** A chosen city; `country` is its ISO code, which the host's form uses to start the currency (008, R7). */
export type CityChoice = { id: number; label: string; country?: string };

/**
 * City with suggestions from GET /cities?q= (US1/AC1). A combobox in the ARIA pattern: type, move with the
 * arrow keys, choose with Enter. Names are shown in the page's language.
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

  function choose(option: (typeof options)[number]) {
    onChange({ id: option.id, label: option.label, country: option.code });
    setText(option.label);
    setOpen(false);
  }

  const name = label ?? t("search.where");
  const showList = open && query.length > 0;
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
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
            else if (event.key === "ArrowDown") setOpen(true);
          }}
          className="ps-9"
        />
      </div>
      <CommandList
        aria-label={name}
        hidden={!showList}
        // Keep the focus in the box while an item is clicked, so the list does not close first.
        onMouseDown={(event) => event.preventDefault()}
        className="absolute top-full z-40 mt-1 w-full rounded-lg border bg-card shadow-lg"
      >
        {showList
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
        {showList && cities.isSuccess && options.length === 0 ? (
          <CommandEmpty>{t("search.noCities")}</CommandEmpty>
        ) : null}
      </CommandList>
    </Command>
  );
}
