"use client";

import {
  CalendarCheckIcon,
  CalendarDaysIcon,
  ClipboardListIcon,
  LayoutDashboardIcon,
  UsersIcon,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRouter } from "@/i18n/navigation";
import { formatCount } from "@/lib/money";
import { AdminBookings } from "./AdminBookings";
import { AdminQueue } from "./AdminQueue";
import { AdminUsers } from "./AdminUsers";
import { AdminHolidays } from "./AdminHolidays";
import { type AdminTab, adminHref, parseTab } from "./adminHref";
import { AdminRequestError, useAdminGate } from "./useAdminGate";
import { useAdminSummary } from "./useAdminSummary";

/**
 * The admin panel (feature 051): three tabs, the review queue, bookings and users, each with its number. The tab
 * is in the address bar (`?tab=`), so a reload and the back button keep it. Only the open tab is drawn and asks
 * for its list.
 */
export function AdminPanel() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const tab = parseTab(useSearchParams().get("tab"));
  const summary = useAdminSummary();
  useAdminGate(summary.error instanceof AdminRequestError ? summary.error.status : undefined);
  const s = summary.data;
  const bookings = s ? Object.values(s.bookings).reduce((sum, n) => sum + n, 0) : undefined;

  const trigger = (value: AdminTab, Icon: typeof UsersIcon, label: string, count: number | undefined) => (
    <TabsTrigger
      value={value}
      className="flex shrink-0 items-center gap-1.5 px-2 sm:gap-2 sm:px-3 sm:text-base"
    >
      <Icon aria-hidden className="size-4" />
      {label}
      {count !== undefined ? (
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums text-foreground">
          {formatCount(count, locale)}
        </span>
      ) : null}
    </TabsTrigger>
  );

  return (
    <div className="grid min-w-0 gap-6" data-admin-workspace>
      <header className="relative overflow-hidden rounded-3xl border bg-card p-5 sm:p-8">
        <div
          className="pointer-events-none absolute -end-16 -top-24 size-72 rounded-full bg-primary/10 blur-3xl"
          aria-hidden
        />
        <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
          <LayoutDashboardIcon className="size-4" aria-hidden />
          {t("admin.overview")}
        </p>
        <h1 className="relative text-2xl font-bold sm:text-3xl">{t("admin.title")}</h1>
        <p className="relative mt-3 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
          {t("admin.overviewIntro")}
        </p>
      </header>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {(
          [
            ["queue", ClipboardListIcon, "tabQueue", s?.pending_listings],
            ["bookings", CalendarCheckIcon, "tabBookings", bookings],
            ["users", UsersIcon, "tabUsers", s?.users],
          ] as const
        ).map(([value, Icon, label, count]) => (
          <button
            type="button"
            key={value}
            onClick={() => router.push(adminHref(value))}
            className="flex min-w-0 items-center gap-4 rounded-2xl border bg-card p-5 text-start transition-colors hover:border-primary/40 hover:bg-primary/5"
          >
            <span className="rounded-2xl bg-primary/10 p-3 text-primary">
              <Icon className="size-5" aria-hidden />
            </span>
            <span className="grid gap-1">
              <span className="text-sm text-muted-foreground">{t(`admin.${label}`)}</span>
              <span className="text-2xl font-bold tabular-nums">
                {count === undefined ? "—" : formatCount(count, locale)}
              </span>
            </span>
          </button>
        ))}
      </div>
      <Tabs
        className="min-w-0"
        value={tab}
        onValueChange={(value) => router.push(adminHref(parseTab(value)))}
      >
        {/* The row scrolls on its own on a narrow phone, never the page. */}
        <TabsList className="overflow-x-auto rounded-2xl border bg-card p-1.5">
          {trigger("queue", ClipboardListIcon, t("admin.tabQueue"), s?.pending_listings)}
          {trigger("bookings", CalendarCheckIcon, t("admin.tabBookings"), bookings)}
          {trigger("users", UsersIcon, t("admin.tabUsers"), s?.users)}
          {trigger("holidays", CalendarDaysIcon, t("admin.tabHolidays"), undefined)}
        </TabsList>
        <TabsContent value="queue" className="pt-4">
          <AdminQueue />
        </TabsContent>
        <TabsContent value="bookings" className="pt-4">
          <AdminBookings />
        </TabsContent>
        <TabsContent value="users" className="pt-4">
          <AdminUsers />
        </TabsContent>
        <TabsContent value="holidays" className="pt-4">
          <AdminHolidays />
        </TabsContent>
      </Tabs>
    </div>
  );
}
