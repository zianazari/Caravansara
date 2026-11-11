"use client";

import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import type { ComponentProps } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

/**
 * Opens the same page, with the same search, in the other language. Extra props (class, menu role, key
 * handling) pass through, so it can also sit inside the account menu as a DropdownMenuItem.
 */
export function LocaleSwitch({ className, ...props }: Omit<ComponentProps<"a">, "href">) {
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
      title={t("language")}
      {...props}
      className={cn("rounded-md px-2 py-1 text-sm hover:bg-muted", className)}
    >
      {t("switchTo")}
    </Link>
  );
}
