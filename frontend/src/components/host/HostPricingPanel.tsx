"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  SaveIcon,
  Trash2Icon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/api/client";
import { DateRangePicker } from "@/components/date/DateRangePicker";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { usePriceQuote } from "@/hooks/usePriceQuote";
import { useMoney } from "@/hooks/useMoney";
import { Link } from "@/i18n/navigation";
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
import { errorMessage, type Translate } from "@/lib/errors";
import { percentInput, pricingDefaults, pricingIssue, type PricingPolicy } from "@/lib/pricing";
import { PricingPolicyFields } from "./PricingPolicyFields";

export function HostPricingPanel({
  listingId,
  basePrice,
  currency,
  country,
}: {
  listingId: number;
  basePrice: string;
  currency: string;
  country: string;
}) {
  const t = useTranslations();
  const query = useQuery({
    queryKey: ["host-pricing", listingId],
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/listings/{listing_id}/pricing", {
        params: { path: { listing_id: listingId } },
      });
      if (!data) throw error;
      return data;
    },
  });
  if (query.isError) return <p role="alert">{t("common.errorText")}</p>;
  if (!query.data) return <Skeleton className="h-96 w-full" />;
  return (
    <PricingEditor
      key={query.dataUpdatedAt}
      initial={pricingDefaults(query.data, country)}
      listingId={listingId}
      basePrice={basePrice}
      currency={currency}
    />
  );
}

function PricingEditor({
  initial,
  listingId,
  basePrice,
  currency,
}: {
  initial: PricingPolicy;
  listingId: number;
  basePrice: string;
  currency: string;
}) {
  const t = useTranslations("pricing");
  const all = useTranslations();
  const client = useQueryClient();
  const money = useMoney();
  const [policy, setPolicy] = useState(initial);
  const [problem, setProblem] = useState("");
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(policy) !== JSON.stringify(initial);
  const updateRange = (index: number, patch: Partial<PricingPolicy["ranges"][number]>) =>
    setPolicy((p) => ({ ...p, ranges: p.ranges.map((r, i) => (i === index ? { ...r, ...patch } : r)) }));
  async function save() {
    const issue = pricingIssue(policy);
    if (issue) {
      setProblem(t(issue));
      return;
    }
    setSaving(true);
    setProblem("");
    try {
      const { data, error } = await api.PUT("/api/v1/listings/{listing_id}/pricing", {
        params: { path: { listing_id: listingId } },
        body: policy,
      });
      if (!data) {
        setProblem(errorMessage(all as unknown as Translate, error));
        return;
      }
      toast.success(t("saved"));
      await Promise.all([
        client.invalidateQueries({ queryKey: ["host-pricing", listingId] }),
        client.invalidateQueries({ queryKey: ["host-listing", listingId] }),
        client.invalidateQueries({ queryKey: ["listing", listingId] }),
        client.invalidateQueries({ queryKey: ["price-quote", listingId] }),
        client.invalidateQueries({ queryKey: ["search"] }),
      ]);
    } catch {
      setProblem(all("common.errorText"));
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(19rem,.85fr)] lg:items-start">
      <div className="grid min-w-0 gap-5">
        <div className="rounded-3xl border bg-card p-5 sm:p-6">
          <p className="text-sm text-muted-foreground">{t("base")}</p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <p className="text-2xl font-bold">{money(basePrice, currency)}</p>
            <Button asChild variant="soft" size="sm">
              <Link href={`/host/listings/${listingId}?tab=details#pricing-base`}>{t("editBase")}</Link>
            </Button>
          </div>
        </div>
        <fieldset disabled={saving} className="grid min-w-0 gap-5">
          <legend className="mb-3 text-xl font-bold">{t("title")}</legend>
          <PricingPolicyFields value={policy} onChange={setPolicy} />
          <section className="grid gap-4 rounded-3xl border bg-card p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-bold">{t("custom")}</h3>
              <Button
                type="button"
                variant="soft"
                size="sm"
                disabled={policy.ranges.length >= 100}
                onClick={() =>
                  setPolicy((p) => ({
                    ...p,
                    ranges: [
                      ...p.ranges,
                      { id: crypto.randomUUID(), name: "", start: "", end: "", percent: "0", enabled: true },
                    ],
                  }))
                }
              >
                <PlusIcon aria-hidden />
                {t("addRange")}
              </Button>
            </div>
            <p className="text-sm leading-7 text-muted-foreground">{t("rangeHint")}</p>
            {!policy.ranges.length ? (
              <p className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
                {t("noRanges")}
              </p>
            ) : null}
            {policy.ranges.map((rule, index) => (
              <div key={rule.id} className="grid gap-4 rounded-2xl border bg-background/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={rule.enabled}
                      onCheckedChange={(enabled) => updateRange(index, { enabled: enabled === true })}
                    />
                    {t("enabled")}
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`${t("remove")}: ${rule.name || t("custom")}`}
                    onClick={() =>
                      setPolicy((p) => ({ ...p, ranges: p.ranges.filter((_, i) => i !== index) }))
                    }
                  >
                    <Trash2Icon aria-hidden />
                  </Button>
                </div>
                <Field label={t("ruleName")}>
                  {(props) => (
                    <Input
                      {...props}
                      maxLength={100}
                      value={rule.name}
                      onChange={(e) => updateRange(index, { name: e.target.value })}
                    />
                  )}
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <p className="text-sm font-medium">{t("start")}</p>
                    <DateRangePicker
                      single
                      label={t("start")}
                      min="2020-01-01"
                      maxDaysAhead={7300}
                      value={{ checkIn: rule.start || undefined }}
                      onChange={(r) => updateRange(index, { start: r.checkIn ?? "" })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <p className="text-sm font-medium">{t("end")}</p>
                    <DateRangePicker
                      single
                      label={t("end")}
                      min={rule.start || "2020-01-01"}
                      maxDaysAhead={7300}
                      value={{ checkIn: rule.end || undefined }}
                      onChange={(r) => updateRange(index, { end: r.checkIn ?? "" })}
                    />
                  </div>
                </div>
                <Field label={t("percent")} hint={t("percentHint")}>
                  {(props) => (
                    <Input
                      {...props}
                      dir="ltr"
                      inputMode="decimal"
                      value={rule.percent}
                      onChange={(e) => updateRange(index, { percent: percentInput(e.target.value) })}
                    />
                  )}
                </Field>
              </div>
            ))}
          </section>
        </fieldset>
        {problem ? (
          <p role="alert" className="rounded-xl border border-destructive/40 p-4 text-sm text-destructive">
            {problem}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => void save()} disabled={saving || !dirty}>
            <SaveIcon aria-hidden />
            {saving ? t("saving") : t("save")}
          </Button>
          {dirty ? <p className="text-sm text-muted-foreground">{t("unsaved")}</p> : null}
        </div>
      </div>
      <div className="grid min-w-0 gap-4 lg:sticky lg:top-24">
        <PricingCalendar listingId={listingId} />
        {dirty ? (
          <p className="rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">
            {t("previewSaved")}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function PricingCalendar({ listingId }: { listingId: number }) {
  const t = useTranslations("pricing");
  const dates = useTranslations("dates");
  const locale = useLocale();
  const money = useMoney();
  const calendar = calendarOf(locale);
  const [month, setMonth] = useState(() => monthOf(calendar, new Date().toISOString().slice(0, 10)));
  const weeks = monthGrid(calendar, month.year, month.month);
  const days = weeks.flat().filter((d): d is string => d !== null);
  const quote = usePriceQuote(listingId, days[0], addDays(days[days.length - 1]!, 1));
  const byDay = new Map(quote.data?.nights.map((n) => [n.date, n]));
  return (
    <section className="grid min-w-0 gap-4 rounded-3xl border bg-card p-4 sm:p-5">
      <h3 className="flex items-center gap-2 text-lg font-bold">
        <CalendarDaysIcon className="size-5 text-primary" aria-hidden />
        {t("calendar")}
      </h3>
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label={dates("previousMonth")}
          onClick={() => setMonth(shiftMonth(month.year, month.month, -1))}
        >
          <ChevronLeftIcon className="rtl:rotate-180" aria-hidden />
        </Button>
        <p className="font-semibold" aria-live="polite">
          {formatMonth(calendar, month.year, month.month, locale)}
        </p>
        <Button
          variant="ghost"
          size="icon"
          aria-label={dates("nextMonth")}
          onClick={() => setMonth(shiftMonth(month.year, month.month, 1))}
        >
          <ChevronRightIcon className="rtl:rotate-180" aria-hidden />
        </Button>
      </div>
      {quote.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {t("quoteError")}
        </p>
      ) : null}
      <div className="grid grid-cols-7 gap-1">
        {weeks[1]!.map((day) => (
          <div key={day} className="pb-2 text-center text-xs text-muted-foreground">
            {new Intl.DateTimeFormat(locale === "fa" ? "fa-IR" : "en-GB", {
              weekday: "narrow",
              timeZone: "UTC",
            }).format(new Date(`${day}T00:00:00Z`))}
          </div>
        ))}
        {weeks.flat().map((day, i) => {
          if (!day) return <span key={`blank-${i}`} />;
          const night = byDay.get(day);
          return (
            <div
              key={day}
              title={
                night
                  ? `${formatDate(day, locale)} · ${money(night.amount, quote.data!.currency)} · ${t(`source_${night.source}`)}${night.label ? `: ${night.label}` : ""}`
                  : formatDate(day, locale)
              }
              className={cn(
                "grid min-h-17 min-w-0 content-start gap-1 rounded-lg border border-transparent p-1.5 text-center",
                night?.source === "custom"
                  ? "border-primary/35 bg-primary/10"
                  : night?.source === "holiday"
                    ? "bg-gold/15"
                    : night?.source === "weekend"
                      ? "bg-water/15"
                      : "bg-muted/35",
              )}
            >
              <span className="text-sm font-medium">{formatDay(day, locale)}</span>
              <span className="break-words text-[10px] leading-4 text-muted-foreground">
                {night ? money(night.amount, quote.data!.currency) : "…"}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {(["base", "weekend", "holiday", "custom"] as const).map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span
              className={cn(
                "size-2 rounded-full",
                s === "custom"
                  ? "bg-primary"
                  : s === "holiday"
                    ? "bg-gold"
                    : s === "weekend"
                      ? "bg-water"
                      : "bg-muted-foreground",
              )}
            />
            {t(`source_${s}`)}
          </span>
        ))}
      </div>
      <p className="text-xs leading-6 text-muted-foreground">{t("calendarHint")}</p>
    </section>
  );
}
