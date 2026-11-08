"use client";

import { MinusIcon, PlusIcon, UsersIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { parseIntInput } from "@/lib/digits";

export type Guests = { adults: number; children: number; infants: number; pets: number };

const LIMITS: Record<keyof Guests, [number, number]> = {
  adults: [1, 50],
  children: [0, 50],
  infants: [0, 10],
  pets: [0, 10],
}; // the API's limits for search and booking

/** Adults, children, infants and pets (FR-016). Infants are shown apart because they don't count. */
export function GuestPicker({ value, onChange }: { value: Guests; onChange: (guests: Guests) => void }) {
  const t = useTranslations("search");
  const count = value.adults + value.children;
  return (
    <div className="grid gap-1.5">
      <span className="text-sm font-medium">{t("guests")}</span>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-start font-normal"
            aria-label={`${t("guests")}: ${t("guestsSummary", { count })}`}
          >
            <UsersIcon />
            {t("guestsSummary", { count })}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="grid w-[min(20rem,calc(100vw-2rem))] gap-4">
          {(Object.keys(LIMITS) as (keyof Guests)[]).map((key) => (
            <Counter
              key={key}
              kind={key}
              value={value[key]}
              onChange={(n) => onChange({ ...value, [key]: n })}
            />
          ))}
        </PopoverContent>
      </Popover>
    </div>
  );
}

function Counter({
  kind,
  value,
  onChange,
}: {
  kind: keyof Guests;
  value: number;
  onChange: (n: number) => void;
}) {
  const t = useTranslations("search");
  const locale = useLocale();
  const id = useId();
  const [min, max] = LIMITS[kind];
  const name = t(kind);
  const hint = kind === "pets" ? undefined : t(`${kind}Hint` as "adultsHint");
  const set = (n: number) => onChange(Math.min(max, Math.max(min, n)));
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <label htmlFor={id} className="font-medium">
          {name}
        </label>
        {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-9 rounded-full"
          disabled={value <= min}
          aria-label={t("decrease", { what: name })}
          onClick={() => set(value - 1)}
        >
          <MinusIcon />
        </Button>
        <input
          id={id}
          inputMode="numeric"
          className="h-9 w-12 rounded-md border bg-card text-center"
          value={new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en").format(value)}
          onChange={(event) => {
            const n = parseIntInput(event.target.value);
            if (n !== null) set(n);
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-9 rounded-full"
          disabled={value >= max}
          aria-label={t("increase", { what: name })}
          onClick={() => set(value + 1)}
        >
          <PlusIcon />
        </Button>
      </div>
    </div>
  );
}
