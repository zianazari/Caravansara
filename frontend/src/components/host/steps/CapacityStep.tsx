"use client";

import { useTranslations } from "next-intl";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { ListingDraft } from "@/lib/listingDraft";
import type { StepProps } from "./types";

type NumberField = "max_guests" | "bedrooms" | "beds" | "bathrooms" | "max_pets";

/** Step 3: guests, rooms and pets. Without pets the number of pets is zero and cannot be changed. */
export function CapacityStep({ draft, onChange, errors }: StepProps) {
  const t = useTranslations("wizard");
  const number = (field: NumberField, label: string, max: number, step = 1, disabled = false) => (
    <Field label={label} error={errors[field]}>
      {(props) => (
        <Input
          {...props}
          type="number"
          inputMode={step < 1 ? "decimal" : "numeric"}
          min={field === "max_guests" ? 1 : 0}
          max={max}
          step={step}
          dir="ltr"
          disabled={disabled}
          value={draft[field] ?? ""}
          onChange={(e) =>
            onChange({ [field]: e.target.value === "" ? undefined : Number(e.target.value) } as ListingDraft)
          }
        />
      )}
    </Field>
  );
  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-2 gap-4">
        {number("max_guests", t("guests"), 50)}
        {number("bedrooms", t("bedrooms"), 50)}
        {number("beds", t("beds"), 100)}
        {number("bathrooms", t("bathrooms"), 50, 0.5)}
      </div>
      <label className="flex items-center gap-3">
        <Checkbox
          checked={draft.pets_allowed ?? false}
          onCheckedChange={(on) =>
            onChange(
              on === true
                ? { pets_allowed: true, max_pets: Math.max(draft.max_pets ?? 0, 1) }
                : { pets_allowed: false, max_pets: 0 },
            )
          }
        />
        <span>{t("petsAllowed")}</span>
      </label>
      {number("max_pets", t("maxPets"), 10, 1, !draft.pets_allowed)}
    </div>
  );
}
