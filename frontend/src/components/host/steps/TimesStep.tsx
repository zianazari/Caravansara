"use client";

import { useTranslations } from "next-intl";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { StepProps } from "./types";

/** Step 7: check-in and check-out, in the listing city's time. */
export function TimesStep({ draft, onChange, errors }: StepProps) {
  const t = useTranslations("wizard");
  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-2 gap-4">
        <Field label={t("checkIn")} error={errors.check_in_time}>
          {(props) => (
            <Input
              {...props}
              type="time"
              dir="ltr"
              value={draft.check_in_time ?? ""}
              onChange={(e) => onChange({ check_in_time: e.target.value })}
            />
          )}
        </Field>
        <Field label={t("checkOut")} error={errors.check_out_time}>
          {(props) => (
            <Input
              {...props}
              type="time"
              dir="ltr"
              value={draft.check_out_time ?? ""}
              onChange={(e) => onChange({ check_out_time: e.target.value })}
            />
          )}
        </Field>
      </div>
      <p className="text-sm text-muted-foreground">{t("timesHint")}</p>
    </div>
  );
}
