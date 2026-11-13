"use client";

import { CalendarDaysIcon, PercentIcon, SparklesIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { addDays } from "@/lib/calendar";
import { percentInput, type PricingPolicy } from "@/lib/pricing";

export function PricingPolicyFields({
  value,
  onChange,
}: {
  value: PricingPolicy;
  onChange: (policy: PricingPolicy) => void;
}) {
  const t = useTranslations("pricing");
  const locale = useLocale();
  const weekdays = locale === "fa" ? [5, 6, 0, 1, 2, 3, 4] : [0, 1, 2, 3, 4, 5, 6];
  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm leading-7">
        <p className="flex items-center gap-2 font-semibold">
          <SparklesIcon className="size-4 text-primary" aria-hidden />
          {t("priorityTitle")}
        </p>
        <p className="text-muted-foreground">{t("priority")}</p>
      </div>
      {(["weekend", "holiday"] as const).map((kind) => (
        <section key={kind} className="grid gap-4 rounded-2xl border bg-card p-4 sm:p-5">
          <label className="flex cursor-pointer items-center gap-3 text-base font-semibold">
            <span className="rounded-xl bg-primary/10 p-2.5 text-primary">
              <CalendarDaysIcon className="size-5" aria-hidden />
            </span>
            <span className="flex-1">{t(kind)}</span>
            <Checkbox
              checked={value[`${kind}_enabled`]}
              onCheckedChange={(checked) => onChange({ ...value, [`${kind}_enabled`]: checked === true })}
            />
          </label>
          <p className="text-sm text-muted-foreground">{t(`${kind}Hint`)}</p>
          {value[`${kind}_enabled`] ? (
            <>
              <Field label={t("percent")} hint={t("percentHint")}>
                {(props) => (
                  <div className="relative max-w-64" dir="ltr">
                    <Input
                      {...props}
                      value={value[`${kind}_percent`]}
                      inputMode="decimal"
                      dir="ltr"
                      onChange={(e) =>
                        onChange({ ...value, [`${kind}_percent`]: percentInput(e.target.value) })
                      }
                      className="pe-10"
                    />
                    <PercentIcon
                      className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden
                    />
                  </div>
                )}
              </Field>
              {kind === "weekend" ? (
                <fieldset className="grid gap-2">
                  <legend className="mb-2 text-sm font-medium">{t("weekdays")}</legend>
                  <div className="flex flex-wrap gap-2">
                    {weekdays.map((day) => {
                      const name = new Intl.DateTimeFormat(locale === "fa" ? "fa-IR" : "en-GB", {
                        weekday: "long",
                        timeZone: "UTC",
                      }).format(new Date(`${addDays("2025-01-06", day)}T00:00:00Z`));
                      const selected = value.weekend_days.includes(day);
                      return (
                        <label
                          key={day}
                          className={cn(
                            "flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm",
                            selected && "border-primary/50 bg-primary/10",
                          )}
                        >
                          <Checkbox
                            checked={selected}
                            onCheckedChange={(checked) =>
                              onChange({
                                ...value,
                                weekend_days: checked
                                  ? [...value.weekend_days, day]
                                  : value.weekend_days.filter((d) => d !== day),
                              })
                            }
                          />
                          {name}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              ) : null}
            </>
          ) : null}
        </section>
      ))}
    </div>
  );
}
