"use client";

import { useQuery } from "@tanstack/react-query";
import { CompassIcon, SparklesIcon, StarIcon, WalletIcon, CalendarDaysIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent, type ReactNode } from "react";
import { api } from "@/api/client";
import { CityCombobox, type CityChoice } from "@/components/search/CityCombobox";
import { GuestPicker, type Guests } from "@/components/search/GuestPicker";
import { DateRangePicker } from "@/components/date/DateRangePicker";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { addDays } from "@/lib/calendar";
import { CURRENCIES, currencyFor } from "@/lib/listingForm";
import { countryName } from "@/lib/names";
import { opportunityBudget, type OpportunityQuery } from "@/lib/opportunities";
import { OpportunityCard } from "./OpportunityCard";

const selectClass =
  "h-12 w-full min-w-0 rounded-xl border border-input bg-background px-3 text-base focus-visible:outline-2 focus-visible:outline-ring";

function Field({ id, label, children }: { id?: string; label: string; children: ReactNode }) {
  return (
    <div className="grid min-w-0 gap-2">
      {id ? (
        <label htmlFor={id} className="text-sm font-semibold">
          {label}
        </label>
      ) : (
        <span className="text-sm font-semibold">{label}</span>
      )}
      {children}
    </div>
  );
}

export function TravelOpportunities({ today }: { today: string }) {
  const t = useTranslations("opportunities");
  const common = useTranslations("common");
  const locale = useLocale();
  const num = (n: number) => new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en").format(n);
  const [country, setCountry] = useState("IR");
  const [city, setCity] = useState<CityChoice>();
  const [currency, setCurrency] = useState("IRR");
  const [budget, setBudget] = useState(num(10000000));
  const [nights, setNights] = useState(3);
  const [arrival, setArrival] = useState(addDays(today, 7));
  const [flex, setFlex] = useState(3);
  const [guests, setGuests] = useState<Guests>({ adults: 2, children: 0, infants: 0, pets: 0 });
  const [invalid, setInvalid] = useState(false);
  const [submitted, setSubmitted] = useState<OpportunityQuery>();
  const countries = useQuery({
    queryKey: ["countries"],
    queryFn: async () => {
      const { data } = await api.GET("/api/v1/countries");
      return data ?? [];
    },
    staleTime: 3600000,
  });
  const result = useQuery({
    queryKey: ["opportunities", submitted],
    enabled: Boolean(submitted),
    staleTime: 0,
    retry: false,
    queryFn: async ({ signal }) => {
      const { data, error } = await api.GET("/api/v1/search/opportunities", {
        params: { query: submitted! },
        signal,
      });
      if (error || !data) throw new Error("opportunities_failed");
      return data;
    },
  });
  const current: OpportunityQuery = {
    budget: opportunityBudget(budget, currency) ?? "0",
    currency,
    country,
    city_id: city?.id,
    preferred_check_in: arrival,
    nights,
    flex_days: flex,
    ...guests,
  };
  const changed = submitted && JSON.stringify(current) !== JSON.stringify(submitted);
  function chooseCountry(code: string) {
    setCountry(code);
    setCity(undefined);
    const next = currencyFor(code);
    setCurrency(next);
    setBudget(num(next === "IRR" ? 10000000 : 600));
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    const amount = opportunityBudget(budget, currency);
    setInvalid(!amount);
    if (!amount) return;
    if (JSON.stringify(current) === JSON.stringify(submitted)) void result.refetch();
    else setSubmitted(current);
  }
  const quickBudgets = currency === "IRR" ? [5000000, 10000000, 20000000] : [300, 600, 1000];
  return (
    <div className="mx-auto grid w-full max-w-[1440px] min-w-0 gap-9 pb-10 md:gap-12" data-wide>
      <section
        aria-labelledby="opportunity-title"
        className="relative isolate overflow-hidden rounded-[2rem] border border-primary/20 bg-surface px-6 py-9 md:px-10 md:py-8"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -end-24 -top-32 size-[32rem] rounded-full border border-primary/10 shadow-[0_0_0_55px_color-mix(in_srgb,var(--primary)_4%,transparent),0_0_0_110px_color-mix(in_srgb,var(--primary)_3%,transparent)]"
        />
        <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-background px-4 py-2 text-sm font-bold text-primary">
          <SparklesIcon className="size-4" aria-hidden />
          {t("name")}
        </p>
        <h1
          id="opportunity-title"
          className="relative max-w-4xl text-3xl leading-[1.7] font-bold tracking-tight md:text-4xl"
        >
          {t("title")}
          <br className="md:hidden" /> <span className="text-primary">{t("accent")}</span>
        </h1>
        <p className="relative mt-4 max-w-2xl text-base leading-8 text-muted-foreground md:text-lg">
          {t("description")}
        </p>
      </section>
      <form
        onSubmit={submit}
        aria-label={t("form")}
        className="grid min-w-0 gap-6 rounded-3xl border bg-card p-5 md:p-8"
      >
        <div className="grid grid-cols-2 items-end gap-5 lg:grid-cols-4">
          <div className="col-span-2 grid gap-2">
            <label htmlFor="trip-budget" className="inline-flex items-center gap-2 text-sm font-semibold">
              <WalletIcon className="size-4 text-primary" aria-hidden />
              {t("budget", { unit: currency === "IRR" ? common("toman") : currency })}
            </label>
            <Input
              id="trip-budget"
              inputMode="decimal"
              dir="ltr"
              value={budget}
              onChange={(e) => {
                setBudget(e.target.value);
                setInvalid(false);
              }}
              aria-invalid={invalid || undefined}
              aria-describedby="budget-help"
              className="h-14 text-xl font-bold"
            />
            <p
              id="budget-help"
              className={invalid ? "text-sm text-destructive" : "text-sm text-muted-foreground"}
              role={invalid ? "alert" : undefined}
            >
              {invalid ? t("invalidBudget") : t("budgetHelp")}
            </p>
          </div>
          <Field id="trip-nights" label={t("nightsLabel")}>
            <select
              id="trip-nights"
              className={selectClass}
              value={nights}
              onChange={(e) => setNights(Number(e.target.value))}
            >
              {Array.from({ length: 30 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {t("nights", { count: num(n) })}
                </option>
              ))}
            </select>
          </Field>
          <GuestPicker value={guests} onChange={setGuests} />
        </div>
        <div className="flex flex-wrap items-center gap-2" aria-label={t("quickBudget")}>
          {quickBudgets.map((n) => (
            <Button
              key={n}
              type="button"
              size="sm"
              variant={current.budget === String(currency === "IRR" ? n * 10 : n) ? "soft" : "outline"}
              onClick={() => setBudget(num(n))}
            >
              {num(n)} {currency === "IRR" ? common("toman") : currency}
            </Button>
          ))}
        </div>
        <div className="grid grid-cols-2 items-end gap-5 lg:grid-cols-3">
          <Field label={t("arrival")}>
            <DateRangePicker
              single
              label={t("arrival")}
              min={today}
              value={{ checkIn: arrival }}
              onChange={(range) => {
                if (range.checkIn) setArrival(range.checkIn);
              }}
            />
          </Field>
          <Field id="trip-flex" label={t("flexibility")}>
            <select
              id="trip-flex"
              className={selectClass}
              value={flex}
              onChange={(e) => setFlex(Number(e.target.value))}
            >
              {[0, 1, 3, 7].map((n) => (
                <option key={n} value={n}>
                  {n === 0 ? t("exactDates") : t("flexDays", { count: num(n) })}
                </option>
              ))}
            </select>
          </Field>
          <Button
            type="submit"
            disabled={result.isFetching}
            className="col-span-2 h-12 text-base font-bold lg:col-span-1"
          >
            <SparklesIcon aria-hidden />
            {result.isFetching ? t("finding") : t("find")}
          </Button>
        </div>
        <details className="border-t pt-4">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
            {t("moreOptions", {
              place: city?.label ?? countryName(country, locale),
              unit: currency === "IRR" ? common("toman") : currency,
            })}
          </summary>
          <div className="mt-5 grid items-end gap-5 sm:grid-cols-3">
            <Field id="trip-country" label={t("country")}>
              <select
                id="trip-country"
                className={selectClass}
                value={country}
                onChange={(e) => chooseCountry(e.target.value)}
              >
                {!countries.data?.some((c) => c.code === "IR") && (
                  <option value="IR">{countryName("IR", locale)}</option>
                )}
                {countries.data?.map((c) => (
                  <option key={c.code} value={c.code}>
                    {countryName(c.code, locale)}
                  </option>
                ))}
              </select>
            </Field>
            <CityCombobox
              label={t("city")}
              value={city}
              onChange={(next) => {
                if (next?.country && next.country !== country) chooseCountry(next.country);
                setCity(next);
              }}
            />
            <Field id="trip-currency" label={t("currency")}>
              <select
                id="trip-currency"
                value={currency}
                className={selectClass}
                onChange={(e) => {
                  setCurrency(e.target.value);
                  setBudget(num(e.target.value === "IRR" ? 10000000 : 600));
                }}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c === "IRR" ? common("toman") : c}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </details>
      </form>
      <section aria-labelledby="opportunity-results" className="grid gap-6" aria-busy={result.isFetching}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 id="opportunity-results" className="text-2xl font-bold md:text-3xl">
              {t("resultsTitle")}
            </h2>
            <p className="mt-2 text-base leading-7 text-muted-foreground">{t("resultsNote")}</p>
          </div>
          <Link href="/" className="text-sm font-semibold text-primary underline-offset-4 hover:underline">
            {t("classicSearch")}
          </Link>
        </div>
        {changed && !result.isFetching ? (
          <p role="status" className="rounded-xl border border-primary/30 bg-surface p-4 text-sm">
            {t("changed")}
          </p>
        ) : null}
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {result.isFetching
            ? t("finding")
            : result.data
              ? t("matchCount", { count: num(result.data.matched_listings) })
              : ""}
        </div>
        {result.isFetching ? (
          <div className="grid gap-6 md:grid-cols-3" role="status" aria-label={t("finding")}>
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-96 animate-pulse rounded-3xl bg-muted motion-reduce:animate-none" />
            ))}
          </div>
        ) : result.isError ? (
          <div role="alert" className="rounded-2xl border border-destructive/40 p-6">
            <p>{t("error")}</p>
            <Button variant="outline" className="mt-4" onClick={() => void result.refetch()}>
              {common("retry")}
            </Button>
          </div>
        ) : result.data && submitted ? (
          result.data.items.length ? (
            <>
              <p className="text-sm text-muted-foreground">
                {t("matchCount", { count: num(result.data.matched_listings) })}
              </p>
              <div className="grid items-stretch gap-6 md:grid-cols-2 xl:grid-cols-3">
                {result.data.items.map((item) => (
                  <OpportunityCard key={item.listing.id} item={item} query={submitted} />
                ))}
              </div>
              <p className="text-sm leading-7 text-muted-foreground">{t("recheck")}</p>
            </>
          ) : (
            <div className="rounded-3xl border border-dashed bg-surface p-8 text-center">
              <CompassIcon className="mx-auto mb-4 size-9 text-primary" aria-hidden />
              <h3 className="text-xl font-bold">{t("emptyTitle")}</h3>
              <p className="mt-3 leading-8 text-muted-foreground">{t("emptyHint")}</p>
            </div>
          )
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {([WalletIcon, StarIcon, CalendarDaysIcon] as const).map((Icon, i) => (
              <div key={i} className="rounded-2xl border bg-surface p-6">
                <Icon className="mb-4 size-6 text-primary" aria-hidden />
                <h3 className="text-lg font-bold">{t(`step${i + 1}Title` as "step1Title")}</h3>
                <p className="mt-2 text-base leading-8 text-muted-foreground">
                  {t(`step${i + 1}Note` as "step1Note")}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
