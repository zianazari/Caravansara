"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import type { components } from "@/api/schema";
import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMoney } from "@/hooks/useMoney";
import { group } from "@/lib/bookingView";
import { formatDate } from "@/lib/calendar";

type Booking = components["schemas"]["BookingOut"];
type BookingPage = components["schemas"]["BookingPage"];
const PAGE = 20;

/**
 * The bookings of one listing, for its host (specs/008-host-pages, US4, R13): upcoming first, then past; each
 * with its dates in the page's calendar, the guests, the status and the amount (toman for rial).
 */
export function HostBookings({ listingId }: { listingId: number }) {
  const t = useTranslations();
  const locale = useLocale();
  const money = useMoney();
  const bookings = useInfiniteQuery({
    queryKey: ["host-bookings", listingId],
    initialPageParam: 0,
    queryFn: async ({ pageParam }): Promise<BookingPage> => {
      const { data, error } = await api.GET("/api/v1/listings/{listing_id}/bookings", {
        params: { path: { listing_id: listingId }, query: { limit: PAGE, offset: pageParam } },
      });
      if (!data) throw error;
      return data;
    },
    getNextPageParam: (last: BookingPage, all: BookingPage[]) => {
      const loaded = all.reduce((n, p) => n + p.items.length, 0);
      return loaded < last.total ? loaded : undefined;
    },
  });
  if (!bookings.data) return <Skeleton className="h-40 w-full" />;
  const all = bookings.data.pages.flatMap((p) => p.items);
  if (all.length === 0) return <p className="text-muted-foreground">{t("host.bookingsEmpty")}</p>;
  const sections: ["upcoming" | "past", Booking[]][] = [
    [
      "upcoming",
      all.filter((b) => group(b) === "upcoming").sort((a, b) => a.check_in.localeCompare(b.check_in)),
    ],
    ["past", all.filter((b) => group(b) === "past").sort((a, b) => b.check_in.localeCompare(a.check_in))],
  ];
  return (
    <div className="grid gap-8">
      {sections.map(([key, items]) =>
        items.length ? (
          <section key={key} aria-labelledby={`bookings-${key}`} className="grid gap-3">
            <h2 id={`bookings-${key}`} className="text-lg font-semibold">
              {t(key === "upcoming" ? "host.bookingsUpcoming" : "host.bookingsPast")}
            </h2>
            <ul className="grid gap-3">
              {items.map((b) => (
                <li key={b.id} className="grid gap-0.5 rounded-2xl border bg-card p-4 shadow-sm">
                  <p className="font-semibold">
                    {t("host.bookingDates", {
                      from: formatDate(b.check_in, locale),
                      to: formatDate(b.check_out, locale),
                    })}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t("booking.guestsLine", { count: b.adults + b.children + b.infants })}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">{t(`booking.status_${b.status}`)}</span> ·{" "}
                    {money(b.total_price, b.currency)}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ) : null,
      )}
      {bookings.hasNextPage ? (
        <Button
          variant="outline"
          className="justify-self-start rounded-full"
          onClick={() => bookings.fetchNextPage()}
          disabled={bookings.isFetchingNextPage}
        >
          {t("host.moreBookings")}
        </Button>
      ) : null}
    </div>
  );
}
