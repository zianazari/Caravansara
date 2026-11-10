"use client";

import { useTranslations } from "next-intl";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { StepProps } from "./types";

/** Step 5: title and description, each with how many characters remain allowed. */
export function DescriptionStep({ draft, onChange, errors }: StepProps) {
  const t = useTranslations("wizard");
  const title = draft.title ?? "";
  const description = draft.description ?? "";
  return (
    <div className="grid gap-5">
      <Field
        label={t("listingTitle")}
        error={errors.title}
        hint={t("chars", { count: title.length, max: 200 })}
      >
        {(props) => <Input {...props} value={title} onChange={(e) => onChange({ title: e.target.value })} />}
      </Field>
      <Field
        label={t("description")}
        error={errors.description}
        hint={t("chars", { count: description.length, max: 5000 })}
      >
        {(props) => (
          <textarea
            {...props}
            rows={8}
            value={description}
            onChange={(e) => onChange({ description: e.target.value })}
            className="w-full rounded-lg border bg-card px-3 py-2 text-base aria-invalid:border-destructive"
          />
        )}
      </Field>
    </div>
  );
}
