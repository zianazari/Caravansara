"use client";

import { useTranslations } from "next-intl";

export function PhoneLink({ phone, name }: { phone?: string | null; name: string }) {
  const t = useTranslations("account");
  if (!phone) return null;
  return (
    <a
      href={`tel:${phone}`}
      dir="ltr"
      className="w-fit max-w-full break-all text-sm text-primary underline underline-offset-4"
      aria-label={`${t("callPerson", { name })} ${phone}`}
    >
      {phone}
    </a>
  );
}
