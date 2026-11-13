"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import type { components } from "@/api/schema";
import { adminApi } from "@/api/adminClient";
import { Pager } from "@/components/ui/Pager";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { formatDate } from "@/lib/calendar";
import { cn } from "@/lib/cn";
import { formatCount, formatInteger, formatMoney } from "@/lib/money";
import { cityName } from "@/lib/names";
import { lastPage, parsePage } from "@/lib/pageWindow";
import { adminHref } from "./adminHref";
import { AdminSortHeader } from "./AdminSortHeader";
import { BOOKING_SORTS, readAdminSort, sortValues } from "./adminSort";
import { AdminRequestError, useAdminGate } from "./useAdminGate";
import { useAdminSummary } from "./useAdminSummary";

type BookingPage = components["schemas"]["AdminBookingPage"];
type Status = components["schemas"]["BookingStatus"];
const STATUSES: Status[] = ["pending", "confirmed", "completed", "cancelled", "expired"];
const PAGE = 20;

/** Each status in its own tint of the theme's colours, so the list reads at a glance; the text follows the active theme. */
const TONE: Record<Status, string> = {
  pending: "bg-gold/20 text-foreground",
  confirmed: "bg-leaf/20 text-foreground",
  completed: "bg-water/25 text-foreground",
  cancelled: "bg-muted text-muted-foreground",
  expired: "bg-destructive/10 text-destructive",
};

function parseStatus(raw: string | null): Status | undefined {
  return STATUSES.find((s) => s === raw);
}

/**
 * Every booking, newest first, one status at a time (feature 051): a compact table of 20 rows with numbered
 * pages, so little scrolling is needed. The totals come from the panel's numbers, asked once.
 */
export function AdminBookings() {
  const t = useTranslations();
  const locale = useLocale();
  const params = useSearchParams();
  const status = parseStatus(params.get("status"));
  const page = parsePage(params.get("page"));
  const { sortBy, order, hasSort } = readAdminSort(params, BOOKING_SORTS, "id");
  const sorting = sortValues(sortBy, order, hasSort);
  const summary = useAdminSummary();
  const list = useQuery({
    queryKey: ["admin", "bookings", status ?? "all", page, sortBy, order],
    retry: false,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<BookingPage> => {
      const { data, error, response } = await adminApi.GET("/api/v1/admin/bookings", {
        params: {
          query: { limit: PAGE, offset: (page - 1) * PAGE, ...(status ? { status } : {}), ...sorting },
        },
      });
      if (!data) throw new AdminRequestError(response.status, error);
      return data;
    },
  });
  useAdminGate(list.error instanceof AdminRequestError ? list.error.status : undefined);

  const counts = summary.data?.bookings;
  const all = counts ? STATUSES.reduce((sum, s) => sum + counts[s], 0) : undefined;
  const total = counts ? (status ? counts[status] : all) : undefined;
  // Before the numbers arrive, the page knows only whether a next one exists.
  const last =
    total !== undefined ? Math.max(lastPage(total, PAGE), page) : list.data?.has_more ? page + 1 : page;
  const href = (s: Status | undefined, n = 1) => adminHref("bookings", { status: s, ...sorting, page: n });
  const money = (amount: string, currency: string) =>
    formatMoney(amount, currency, locale, t("common.toman"));
  const day = (iso: string) => formatDate(iso.slice(0, 10), locale, "short");

  const chip = (s: Status | undefined, label: string, count: number | undefined) => (
    <Link
      key={s ?? "all"}
      href={href(s)}
      aria-current={s === status ? "page" : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors hover:bg-muted",
        s === status && "border-primary bg-primary text-primary-foreground hover:bg-primary",
      )}
    >
      {label}
      {count !== undefined ? (
        <span className="font-semibold tabular-nums">{formatCount(count, locale)}</span>
      ) : null}
    </Link>
  );

  return (
    <div className="grid min-w-0 gap-4">
      <h2 className="sr-only">{t("admin.bookingsTitle")}</h2>
      <nav aria-label={t("admin.statusFilter")} className="flex flex-wrap gap-2">
        {chip(undefined, t("admin.statusAll"), all)}
        {STATUSES.map((s) => chip(s, t(`admin.status_${s}`), counts?.[s]))}
      </nav>
      {list.isError ? (
        <p role="alert" className="text-destructive">
          {t("common.errorText")}
        </p>
      ) : !list.data ? (
        <Skeleton className="h-96 w-full" />
      ) : list.data.items.length === 0 ? (
        <p className="rounded-2xl border bg-surface p-6">{t("admin.bookingsEmpty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-start text-xs text-muted-foreground">
              <tr>
                {(
                  [
                    ["id", "colBooking"],
                    ["listing", "colListing"],
                    ["guest", "colGuest"],
                    ["dates", "colDates"],
                    ["total_price", "colTotal"],
                    ["status", "colStatus"],
                    ["created_at", "colMade"],
                  ] as const
                ).map(([column, label]) => (
                  <AdminSortHeader
                    key={column}
                    column={column}
                    label={t(`admin.${label}`)}
                    sortBy={sortBy}
                    order={order}
                    href={adminHref("bookings", {
                      status,
                      ...sortValues(column, sortBy === column && order === "asc" ? "desc" : "asc"),
                    })}
                    className={column === "created_at" ? "hidden lg:table-cell" : undefined}
                    hint={column === "total_price" ? t("admin.sortAmountsHint") : undefined}
                  />
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {list.data.items.map((b) => (
                <tr key={b.id} className="align-top hover:bg-muted/40">
                  <td className="px-3 py-1.5 tabular-nums text-muted-foreground">
                    {formatInteger(b.id, locale)}
                  </td>
                  <td className="max-w-56 px-3 py-1.5">
                    <div className="truncate font-medium">{b.listing.title}</div>
                    <div className="text-xs text-muted-foreground">{cityName(t, b.listing.city)}</div>
                  </td>
                  <td className="max-w-56 px-3 py-1.5">
                    <div className="truncate">{b.guest_name}</div>
                    <div className="truncate text-xs text-muted-foreground" dir="ltr">
                      {b.guest_email}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5">
                    <div>
                      {day(b.check_in)} – {day(b.check_out)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t("admin.nights", { count: b.nights })}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5 tabular-nums">
                    {money(b.total_price, b.currency)}
                  </td>
                  <td className="px-3 py-1.5">
                    <span
                      className={cn(
                        "inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold",
                        TONE[b.status],
                      )}
                    >
                      {t(`admin.status_${b.status}`)}
                    </span>
                  </td>
                  <td className="hidden whitespace-nowrap px-3 py-1.5 text-muted-foreground lg:table-cell">
                    {day(b.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} last={last} hrefFor={(n) => href(status, n)} />
    </div>
  );
}
