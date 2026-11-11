"use client";

import { useTranslations } from "next-intl";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { StepProps } from "./types";

const TYPES = ["entire_place", "private_room", "shared_room"] as const;

/** Step 1: the kind of place, as three large choices (a shadcn/ui RadioGroup, feature 026). */
export function TypeStep({ draft, onChange, errors }: StepProps) {
  const t = useTranslations();
  return (
    <div className="grid gap-3">
      <RadioGroup
        aria-label={t("wizard.step_type")}
        aria-describedby={errors.property_type ? "type-error" : undefined}
        value={draft.property_type ?? ""}
        onValueChange={(value) => onChange({ property_type: value as (typeof TYPES)[number] })}
      >
        {TYPES.map((type) => (
          <label
            key={type}
            className="flex cursor-pointer items-start gap-3 rounded-xl border bg-card p-4 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:ring-1 has-[[data-state=checked]]:ring-primary"
          >
            <RadioGroupItem value={type} className="mt-0.5" />
            <span className="grid gap-0.5">
              <span className="font-semibold">{t(`propertyTypes.${type}`)}</span>
              <span className="text-sm text-muted-foreground">{t(`wizard.type_${type}`)}</span>
            </span>
          </label>
        ))}
      </RadioGroup>
      {errors.property_type ? (
        <p id="type-error" role="alert" className="text-sm text-destructive">
          {errors.property_type}
        </p>
      ) : null}
    </div>
  );
}
