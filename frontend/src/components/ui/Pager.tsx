"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { formatInteger } from "@/lib/money";
import { pageWindow } from "@/lib/pageWindow";

const cell = "inline-flex h-9 min-w-9 items-center justify-center rounded-full px-2 text-sm";

/**
 * Numbered pages (feature 025): previous, page 1, at most 10 pages around the current one, the last page,
 * next. Each page is a link, so the address bar holds the page: reload and the back button keep it, and a
 * page can open in a new tab. Nothing is shown when everything fits on one page.
 */
export function Pager({
  page,
  last,
  hrefFor,
}: {
  page: number;
  last: number;
  hrefFor: (page: number) => string;
}) {
  const t = useTranslations("common");
  const locale = useLocale();
  if (last <= 1) return null;
  const n = (value: number) => formatInteger(value, locale);
  return (
    <nav aria-label={t("pages")} className="flex flex-wrap items-center gap-1">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={cn(cell, "gap-1 hover:bg-muted")}>
          <ChevronLeftIcon aria-hidden className="size-4 rtl:-scale-x-100" />
          {t("previousPage")}
        </Link>
      ) : null}
      {pageWindow(page, last).map((slot, i) =>
        slot === "gap" ? (
          <span key={`gap-${i}`} aria-hidden className={cn(cell, "text-muted-foreground")}>
            …
          </span>
        ) : slot === page ? (
          <span
            key={slot}
            aria-current="page"
            aria-label={t("pageNumber", { page: n(slot) })}
            className={cn(cell, "bg-primary font-semibold text-primary-foreground")}
          >
            {n(slot)}
          </span>
        ) : (
          <Link
            key={slot}
            href={hrefFor(slot)}
            aria-label={t("pageNumber", { page: n(slot) })}
            className={cn(cell, "hover:bg-muted")}
          >
            {n(slot)}
          </Link>
        ),
      )}
      {page < last ? (
        <Link href={hrefFor(page + 1)} className={cn(cell, "gap-1 hover:bg-muted")}>
          {t("nextPage")}
          <ChevronRightIcon aria-hidden className="size-4 rtl:-scale-x-100" />
        </Link>
      ) : null}
    </nav>
  );
}
