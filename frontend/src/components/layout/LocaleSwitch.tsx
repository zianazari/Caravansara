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
      className={cn(
        // A pill button since feature 031: everything clickable looks like a button.
        "inline-flex h-9 items-center rounded-full border bg-card px-3 text-sm font-semibold transition-[transform,background-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:bg-muted hover:shadow-sm",
        className,
      )}
    >
      {t("switchTo")}
    </Link>
  );
}
