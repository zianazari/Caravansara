"use client";

import { useTranslations } from "next-intl";
import { Field } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CURRENCIES, currencyFor } from "@/lib/listingForm";
import { MoneyInput } from "../MoneyInput";
import type { StepProps } from "./types";

/**
 * Step 6: currency and prices (research R7). The currency starts from the city's country; rial is typed in
 * toman. Changing the currency keeps the typed numbers: the host is told the unit next to each field.
 */
export function PriceStep({ draft, onChange, errors }: StepProps) {
  const t = useTranslations("wizard");
  const currency = draft.currency ?? currencyFor(draft.country_code);
  return (
    <div className="grid gap-5">
      <Field label={t("currency")} error={errors.currency}>
        {(props) => (
          <Select value={currency} onValueChange={(value) => onChange({ currency: value })}>
            <SelectTrigger {...props} className="text-base">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((code) => (
                <SelectItem key={code} value={code}>
                  {code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </Field>
      <MoneyInput
        label={t("price")}
        currency={currency}
        value={draft.price_per_night ?? ""}
        onChange={(text) => onChange({ price_per_night: text, currency })}
        error={errors.price_per_night}
      />
      <MoneyInput
        label={t("cleaning")}
        currency={currency}
        value={draft.cleaning_fee ?? ""}
        onChange={(text) => onChange({ cleaning_fee: text, currency })}
        error={errors.cleaning_fee}
      />
    </div>
  );
}
