"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import type { ComponentProps } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import ukFlag from "flag-icons/flags/4x3/gb.svg";
import iranFlag from "flag-icons/flags/4x3/ir.svg";

/**
 * Opens the same page, with the same search, in the other language. Extra props (class, menu role, key
 * handling) pass through, so it can also sit inside the account menu as a DropdownMenuItem.
 *
 * Feature 046 (owner's request): the flag of the language it switches to sits beside the name: Iran's on
 * the English site, the United Kingdom's on the Persian site (the English site formats as en-GB). SVG flags
 * from flag-icons (MIT), because emoji flags show as two letters on Windows. The flag is decoration; the
 * name says the same.
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
        "inline-flex h-9 items-center gap-2 rounded-full border bg-card px-3 text-sm font-semibold transition-[transform,background-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:bg-muted hover:shadow-sm",
        className,
      )}
    >
      <Image
        src={other === "fa" ? iranFlag : ukFlag}
        alt=""
        aria-hidden
        width={20}
        height={15}
        unoptimized // an SVG needs no resizing
        data-flag={other}
        className="h-[15px] w-5 shrink-0 rounded-[3px] object-cover shadow-[0_0_0_1px_var(--border)]"
      />
      {t("switchTo")}
    </Link>
  );
}
