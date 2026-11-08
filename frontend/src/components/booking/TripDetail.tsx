"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPinIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import type { components } from "@/api/schema";
import { api, serverSkewMs } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMoney } from "@/hooks/useMoney";
import { Link } from "@/i18n/navigation";
import { clearDraft } from "@/lib/bookingDraft";
import { remainingMs } from "@/lib/bookingView";
import { formatDate } from "@/lib/calendar";
import { formatClock } from "@/lib/cityTime";
import { errorCode, errorMessage, type Translate } from "@/lib/errors";
import { cityName } from "@/lib/names";
import { stayQuery } from "@/lib/searchParams";
import { HoldCountdown } from "./HoldCountdown";
import { PriceBreakdown } from "./PriceBreakdown";

export type Booking = components["schemas"]["BookingOut"];

/**
 * One booking (US3/AC2, AC3, AC7, FR-026 to FR-028). A pending hold shows the time left and the simulated
 * payment; a paid booking shows the exact address and the check-in and check-out times in the listing's city.
 * `children` is where the trips view adds cancelling and reviewing (US4, US5).
 */
export function TripDetail({
  bookingId,
  children,
}: {
  bookingId: number;
  children?: (booking: Booking) => React.ReactNode;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const money = useMoney();
  const queryClient = useQueryClient();
  const [ended, setEnded] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  const booking = useQuery({
    queryKey: ["booking", bookingId],
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/bookings/{booking_id}", {
        params: { path: { booking_id: bookingId } },
      });
      if (!data) throw error;
      return data;
    },
  });
  const remaining = useCallback(
    () => (booking.data ? remainingMs(booking.data, Date.now(), serverSkewMs()) : 0),
    [booking.data],
  );
  const onExpire = useCallback(() => setEnded(true), []);

  if (booking.isError) {
    return (
      <p role="alert" className="text-destructive">
        {errorMessage(t as unknown as Translate, booking.error)}
      </p>
    );
  }
  if (!booking.data) return <Skeleton className="h-64 w-full" />;
  const b = booking.data;
  const city = cityName(t, b.listing.city);

  async function pay() {
    setPaying(true);
    setProblem(null);
    const result = await api.POST("/api/v1/bookings/{booking_id}/pay", {
      params: { path: { booking_id: bookingId } },
    });
    setPaying(false);
    if (result.data) {
      clearDraft();
      queryClient.setQueryData(["booking", bookingId], result.data);
      void queryClient.invalidateQueries({ queryKey: ["trips"] });
      toast.success(t("booking.paid"));
    } else {
      if (errorCode(result.error) === "hold_expired") setEnded(true);
      setProblem(errorMessage(t as unknown as Translate, result.error));
    }
  }

  // The countdown calls onExpire at once when the hold is already over (by the server's clock), so the
  // render itself never reads the clock.
  const holdOpen = b.status === "pending" && !ended;
  const again = `/listings/${b.listing.id}?${stayQuery(b).toString()}`;

  return (
    <article className="grid max-w-2xl gap-5">
      <header className="grid gap-1">
        <p className="text-sm font-medium text-primary">{t(`booking.status_${b.status}`)}</p>
        <h1 className="text-2xl font-bold">{b.listing.title}</h1>
        <p className="text-muted-foreground">
          {city} · {formatDate(b.check_in, locale, "long")} – {formatDate(b.check_out, locale, "long")} ·{" "}
          {t("booking.guestsLine", { count: b.adults + b.children })}
        </p>
      </header>

      <PriceBreakdown
        pricePerNight={b.nightly_price}
        cleaningFee={b.cleaning_fee}
        currency={b.currency}
        checkIn={b.check_in}
        checkOut={b.check_out}
      />

      {b.status === "pending" ? (
        holdOpen ? (
          <section className="grid gap-3">
            <HoldCountdown remainingAt={remaining} onExpire={onExpire} />
            <p className="text-sm text-muted-foreground">{t("booking.simulated")}</p>
            <Button size="lg" onClick={pay} disabled={paying}>
              {t("booking.pay", { amount: money(b.total_price, b.currency) })}
            </Button>
          </section>
        ) : (
          <section role="alert" className="grid gap-2 rounded-lg border p-4">
            <p className="font-medium">{t("booking.holdEnded")}</p>
            <Button asChild variant="outline" className="justify-self-start" onClick={() => clearDraft()}>
              <Link href={again}>{t("booking.bookAgain")}</Link>
            </Button>
          </section>
        )
      ) : null}
      {problem && b.status === "pending" && holdOpen ? (
        <p role="alert" className="text-sm text-destructive">
          {problem}
        </p>
      ) : null}

      {b.address ? (
        <section aria-labelledby="where" className="grid gap-2 rounded-lg border p-4">
          <h2 id="where" className="flex items-center gap-2 font-semibold">
            <MapPinIcon className="size-4" aria-hidden />
            {t("booking.address")}
          </h2>
          <p>{b.address.address}</p>
          <p>{t("booking.checkInAt", { time: formatClock(b.address.check_in_time, locale), city })}</p>
          <p>{t("booking.checkOutAt", { time: formatClock(b.address.check_out_time, locale), city })}</p>
        </section>
      ) : null}

      {children?.(b)}
    </article>
  );
}
