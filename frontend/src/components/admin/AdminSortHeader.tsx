"use client";

import { ArrowDownIcon, ArrowUpIcon, ArrowUpDownIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import type { SortOrder } from "./adminSort";

export function AdminSortHeader({
  column,
  label,
  sortBy,
  order,
  href,
  className,
  hint,
}: {
  column: string;
  label: string;
  sortBy: string;
  order: SortOrder;
  href: string;
  className?: string;
  hint?: string;
}) {
  const t = useTranslations("admin");
  const active = column === sortBy;
  const next = active && order === "asc" ? "desc" : "asc";
  const Icon = active ? (order === "asc" ? ArrowUpIcon : ArrowDownIcon) : ArrowUpDownIcon;
  return (
    <th
      scope="col"
      aria-sort={active ? (order === "asc" ? "ascending" : "descending") : "none"}
      className={cn("px-3 py-1 text-start font-medium", className)}
    >
      <Link
        href={href}
        scroll={false}
        title={hint}
        aria-label={t(next === "asc" ? "sortAscending" : "sortDescending", { column: label })}
        className={cn(
          "inline-flex min-h-11 items-center gap-1.5 rounded-md transition-colors hover:text-primary focus-visible:outline-2",
          active && "text-primary",
        )}
      >
        {label}
        <Icon className="size-3.5 shrink-0" aria-hidden />
      </Link>
    </th>
  );
}
