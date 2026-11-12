"use client";

import { CalendarCheckIcon, ClipboardListIcon, UsersIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRouter } from "@/i18n/navigation";
import { formatCount } from "@/lib/money";
import { AdminBookings } from "./AdminBookings";
import { AdminQueue } from "./AdminQueue";
import { AdminUsers } from "./AdminUsers";
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
    <div className="grid min-w-0 gap-4">
      <h1 className="text-2xl font-bold">{t("admin.title")}</h1>
      <Tabs
        className="min-w-0"
        value={tab}
        onValueChange={(value) => router.push(adminHref(parseTab(value)))}
      >
        {/* The row scrolls on its own on a narrow phone, never the page. */}
        <TabsList className="overflow-x-auto">
          {trigger("queue", ClipboardListIcon, t("admin.tabQueue"), s?.pending_listings)}
          {trigger("bookings", CalendarCheckIcon, t("admin.tabBookings"), bookings)}
          {trigger("users", UsersIcon, t("admin.tabUsers"), s?.users)}
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
      </Tabs>
    </div>
  );
}
