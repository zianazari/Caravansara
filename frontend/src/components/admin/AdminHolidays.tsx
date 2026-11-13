"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { adminApi } from "@/api/adminClient";
import { DateRangePicker } from "@/components/date/DateRangePicker";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addDays, calendarOf, formatDate, formatMonth, monthGrid, monthOf, shiftMonth } from "@/lib/calendar";
import { countryName } from "@/lib/names";
import { errorMessage, type Translate } from "@/lib/errors";
import { AdminRequestError, useAdminGate } from "./useAdminGate";

export function AdminHolidays() {
  const t = useTranslations("pricing");
  const all = useTranslations();
  const dates = useTranslations("dates");
  const locale = useLocale();
  const client = useQueryClient();
  const calendar = calendarOf(locale);
  const [country, setCountry] = useState("IR");
  const [day, setDay] = useState<string>();
  const [name, setName] = useState("");
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  const [month, setMonth] = useState(() => monthOf(calendar, new Date().toISOString().slice(0, 10)));
  const days = monthGrid(calendar, month.year, month.month)
    .flat()
    .filter((d): d is string => d !== null);
  const countries = useQuery({
    queryKey: ["admin", "countries"],
    queryFn: async () => {
      const { data, error, response } = await adminApi.GET("/api/v1/admin/countries");
      if (!data) throw new AdminRequestError(response.status, error);
      return data;
    },
  });
  const holidays = useQuery({
    queryKey: ["admin", "holidays", country, days[0], days[days.length - 1]],
    queryFn: async () => {
      const { data, error, response } = await adminApi.GET("/api/v1/admin/holidays", {
        params: { query: { country, start: days[0]!, end: addDays(days[days.length - 1]!, 1) } },
      });
      if (!data) throw new AdminRequestError(response.status, error);
      return data;
    },
  });
  useAdminGate(
    holidays.error instanceof AdminRequestError
      ? holidays.error.status
      : countries.error instanceof AdminRequestError
        ? countries.error.status
        : undefined,
  );
  async function save() {
    if (!day || !name.trim()) {
      setProblem(t("holidayRequired"));
      return;
    }
    setBusy(true);
    setProblem("");
    try {
      const { data, error } = await adminApi.PUT("/api/v1/admin/holidays/{country}/{day}", {
        params: { path: { country, day } },
        body: { name: name.trim() },
      });
      if (!data) {
        setProblem(errorMessage(all as unknown as Translate, error));
        return;
      }
      setMonth(monthOf(calendar, day));
      setName("");
      toast.success(t("holidaySaved"));
      await client.invalidateQueries({ queryKey: ["admin", "holidays"] });
    } catch {
      setProblem(all("common.errorText"));
    } finally {
      setBusy(false);
    }
  }
  async function remove(holiday: { country_code: string; day: string }) {
    setBusy(true);
    setProblem("");
    try {
      const { error, response } = await adminApi.DELETE("/api/v1/admin/holidays/{country}/{day}", {
        params: { path: { country: holiday.country_code, day: holiday.day } },
      });
      if (!response.ok) {
        setProblem(errorMessage(all as unknown as Translate, error));
        return;
      }
      toast.success(t("holidayRemoved"));
      await client.invalidateQueries({ queryKey: ["admin", "holidays"] });
    } catch {
      setProblem(all("common.errorText"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)] lg:items-start">
      <section className="grid gap-5 rounded-3xl border bg-card p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="rounded-2xl bg-primary/10 p-3 text-primary">
            <CalendarDaysIcon aria-hidden />
          </span>
          <h2 className="text-xl font-bold">{t("holidaysTitle")}</h2>
        </div>
        <p className="text-sm leading-7 text-muted-foreground">{t("holidaysIntro")}</p>
        <Field label={t("country")}>
          {(props) => (
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger {...props}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(countries.data ?? []).map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {countryName(c.code, locale)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
        <div className="grid gap-2">
          <p className="text-sm font-medium">{t("holidayDate")}</p>
          <DateRangePicker
            single
            label={t("holidayDate")}
            min="2020-01-01"
            maxDaysAhead={7300}
            value={{ checkIn: day }}
            onChange={(r) => setDay(r.checkIn)}
          />
        </div>
        <Field label={t("holidayName")}>
          {(props) => (
            <Input {...props} maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
          )}
        </Field>
        {problem ? (
          <p role="alert" className="text-sm text-destructive">
            {problem}
          </p>
        ) : null}
        <Button disabled={busy} onClick={() => void save()}>
          <PlusIcon aria-hidden />
          {t("addHoliday")}
        </Button>
        <p className="rounded-xl bg-muted/40 p-3 text-xs leading-6 text-muted-foreground">
          {t("holidayNote")}
        </p>
      </section>
      <section className="grid gap-4 rounded-3xl border bg-card p-5 sm:p-6">
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label={dates("previousMonth")}
            onClick={() => setMonth(shiftMonth(month.year, month.month, -1))}
          >
            <ChevronLeftIcon className="rtl:rotate-180" aria-hidden />
          </Button>
          <h3 className="font-bold" aria-live="polite">
            {formatMonth(calendar, month.year, month.month, locale)}
          </h3>
          <Button
            variant="ghost"
            size="icon"
            aria-label={dates("nextMonth")}
            onClick={() => setMonth(shiftMonth(month.year, month.month, 1))}
          >
            <ChevronRightIcon className="rtl:rotate-180" aria-hidden />
          </Button>
        </div>
        {holidays.isError || countries.isError ? (
          <p role="alert">{all("common.errorText")}</p>
        ) : holidays.isPending ? (
          <p role="status">{t("loading")}</p>
        ) : holidays.data?.length ? (
          <ul className="grid gap-2">
            {holidays.data.map((h) => (
              <li key={h.day} className="flex items-center gap-3 rounded-2xl border bg-background/60 p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{h.name}</p>
                  <p className="text-sm text-muted-foreground">{formatDate(h.day, locale, "long")}</p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={busy}
                  aria-label={`${t("remove")}: ${h.name} · ${formatDate(h.day, locale)}`}
                  onClick={() => void remove(h)}
                >
                  <Trash2Icon aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            {t("noHolidays")}
          </p>
        )}
      </section>
    </div>
  );
}
