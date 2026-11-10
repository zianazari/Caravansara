"use client";

import { useTranslations } from "next-intl";
import { CityCombobox } from "@/components/search/CityCombobox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { currencyFor } from "@/lib/listingForm";
import { LocationPicker } from "../LocationPicker";
import type { StepProps } from "./types";

/** Step 2: city, neighbourhood, the private address and the exact point (research R6). */
export function LocationStep({
  draft,
  onChange,
  errors,
  loadMap,
}: StepProps & { loadMap?: () => Promise<typeof import("maplibre-gl")> }) {
  const t = useTranslations();
  const city =
    draft.city_id && draft.city_label
      ? { id: draft.city_id, label: draft.city_label, country: draft.country_code }
      : undefined;
  return (
    <div className="grid gap-5">
      <div className="grid gap-1.5">
        <CityCombobox
          label={t("wizard.city")}
          value={city}
          invalid={Boolean(errors.city_id)}
          describedBy={errors.city_id ? "city-error" : undefined}
          onChange={(chosen) =>
            onChange(
              chosen
                ? {
                    city_id: chosen.id,
                    city_label: chosen.label,
                    country_code: chosen.country,
                    // A new city starts with its country's currency, until the host picks one (R7).
                    currency: currencyFor(chosen.country),
                    latitude: chosen.id === draft.city_id ? draft.latitude : undefined,
                    longitude: chosen.id === draft.city_id ? draft.longitude : undefined,
                  }
                : { city_id: undefined, city_label: undefined },
            )
          }
        />
        {errors.city_id ? (
          <p id="city-error" role="alert" className="text-sm text-destructive">
            {errors.city_id}
          </p>
        ) : null}
      </div>
      <Field label={t("wizard.neighborhood")} error={errors.neighborhood}>
        {(props) => (
          <Input
            {...props}
            maxLength={100}
            value={draft.neighborhood ?? ""}
            onChange={(e) => onChange({ neighborhood: e.target.value })}
          />
        )}
      </Field>
      <Field label={t("wizard.address")} error={errors.address}>
        {(props) => (
          <Input
            {...props}
            maxLength={300}
            autoComplete="street-address"
            value={draft.address ?? ""}
            onChange={(e) => onChange({ address: e.target.value })}
          />
        )}
      </Field>
      <LocationPicker
        cityId={draft.city_id}
        value={{ latitude: draft.latitude, longitude: draft.longitude }}
        onChange={(point) => onChange(point)}
        error={errors.latitude ?? errors.longitude}
        loadMap={loadMap}
      />
    </div>
  );
}
