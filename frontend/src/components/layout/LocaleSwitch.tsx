"use client";

import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link, usePathname } from "@/i18n/navigation";

/** Opens the same page, with the same search, in the other language. */
export function LocaleSwitch() {
  const t = useTranslations("nav");
  const locale = useLocale();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const other = locale === "fa" ? "en" : "fa";
  return (
    <Link
      href={search ? `${pathname}?${search}` : pathname}
      locale={other}
      lang={other}
      hrefLang={other}
      className="rounded-md px-2 py-1 text-sm hover:bg-muted"
      title={t("language")}
    >
      {t("switchTo")}
    </Link>
  );
}
