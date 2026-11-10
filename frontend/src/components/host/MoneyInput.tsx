"use client";

import { useTranslations } from "next-intl";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

/**
 * A price as the host types it (specs/008-host-pages, research R7). For rial the field is in toman, like every
 * price on the site, and the form multiplies by ten before sending (lib/listingForm `priceForApi`). Persian
 * digits and thousands separators are accepted, so it is a text field with a decimal keypad, not a number
 * field, which would refuse "۱٬۲۰۰".
 */
export function MoneyInput({
  label,
  currency,
  value,
  onChange,
  error,
}: {
  label: string;
  currency: string;
  value: string;
  onChange: (text: string) => void;
  error?: string;
}) {
  const t = useTranslations();
  const unit = currency === "IRR" ? t("common.toman") : currency;
  return (
    <Field label={label} error={error} hint={currency === "IRR" ? t("wizard.tomanHint") : undefined}>
      {(props) => (
        <div className="relative">
          <Input
            {...props}
            inputMode="decimal"
            autoComplete="off"
            dir="ltr"
            className="pe-20 text-end"
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-sm text-muted-foreground"
          >
            {unit}
          </span>
        </div>
      )}
    </Field>
  );
}
