"use client";

import { useLocale, useTranslations } from "next-intl";
import { formatMoney } from "@/lib/money";

/** Formats money in the page's language, with the translated toman label (FR-007). */
export function useMoney() {
  const locale = useLocale();
  const t = useTranslations("common");
  return (amount: string, currency: string) => formatMoney(amount, currency, locale, t("toman"));
}
