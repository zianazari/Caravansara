"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import type { StepProps } from "./types";

const TYPES = ["entire_place", "private_room", "shared_room"] as const;

/** Step 1: the kind of place, as three large choices (a radio group). */
export function TypeStep({ draft, onChange, errors }: StepProps) {
  const t = useTranslations();
  return (
    <fieldset className="grid gap-3" aria-describedby={errors.property_type ? "type-error" : undefined}>
      <legend className="sr-only">{t("wizard.step_type")}</legend>
      {TYPES.map((type) => (
        <label
          key={type}
          className={cn(
            "flex cursor-pointer items-start gap-3 rounded-xl border bg-card p-4 has-[:checked]:border-primary has-[:checked]:ring-1 has-[:checked]:ring-primary",
          )}
        >
          <input
            type="radio"
            name="property_type"
            className="mt-1 size-4 accent-primary"
            checked={draft.property_type === type}
            onChange={() => onChange({ property_type: type })}
          />
          <span className="grid gap-0.5">
            <span className="font-semibold">{t(`propertyTypes.${type}`)}</span>
            <span className="text-sm text-muted-foreground">{t(`wizard.type_${type}`)}</span>
          </span>
        </label>
      ))}
      {errors.property_type ? (
        <p id="type-error" role="alert" className="text-sm text-destructive">
          {errors.property_type}
        </p>
      ) : null}
    </fieldset>
  );
}
