"use client";

import { useQuery } from "@tanstack/react-query";
import { CircleCheckIcon, PrinterIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { api } from "@/api/client";
import { LogoMark } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMe } from "@/hooks/useAuth";
import { useMoney } from "@/hooks/useMoney";
import { Link } from "@/i18n/navigation";
import { formatDate } from "@/lib/calendar";
import { formatClock } from "@/lib/cityTime";
import { errorMessage, type Translate } from "@/lib/errors";
import { cityName } from "@/lib/names";
import { PriceBreakdown } from "./PriceBreakdown";

const TAG: Record<string, string> = { fa: "fa-IR-u-ca-persian-nu-arabext", en: "en-GB" };

/** A booking's receipt number: the booking id, so it is stable and easy to quote ("CRV-000123"). */
export function receiptNumber(id: number): string {
  return `CRV-${String(id).padStart(6, "0")}`;
}

/**
 * The payment's success page and its receipt (feature 047, owner's request). After paying, the guest lands
 * here: a success message, then a receipt card with the receipt number, when it was paid, the guest, the
 * place and its exact address (shown once paid), the stay, the guests and the amounts. "Print receipt"
 * opens the browser's print dialog; the header, the footer, the bottom bar and this page's own buttons are
 * hidden in print (.no-print), so only the receipt is printed. A booking that is not paid has no receipt.
 */
export function Receipt({ bookingId }: { bookingId: number }) {
  const t = useTranslations();
  const locale = useLocale();
  const money = useMoney();
  const me = useMe();
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

  if (booking.isError) {
    return (
      <p role="alert" className="text-destructive">
        {errorMessage(t as unknown as Translate, booking.error)}
      </p>
    );
  }
  if (!booking.data) return <Skeleton className="h-96 w-full max-w-2xl" />;
  const b = booking.data;
  const trip = `/trips/${b.id}`;
  if (b.status !== "confirmed" && b.status !== "completed") {
    return (
      <section role="status" className="grid max-w-2xl justify-items-start gap-3 rounded-2xl border p-5">
        <p>{t("booking.notPaidYet")}</p>
        <Button asChild variant="soft" size="sm">
          <Link href={trip}>{t("booking.viewTrip")}</Link>
        </Button>
      </section>
    );
  }

  // The payment time in the visitor's own time zone and calendar; a booking paid before 047 has none.
  const paidAt = b.paid_at
    ? new Intl.DateTimeFormat(TAG[locale] ?? locale, { dateStyle: "long", timeStyle: "short" }).format(
        new Date(b.paid_at),
      )
    : "—";
  const rows: [string, React.ReactNode][] = [
    [
      t("booking.receiptNo"),
      <span key="no" dir="ltr">
        {receiptNumber(b.id)}
      </span>,
    ],
    [t("booking.paidAt"), paidAt],
    [t("booking.guest"), me.data?.full_name ?? "—"],
    [t("booking.place"), `${b.listing.title} · ${cityName(t, b.listing.city)}`],
    ...(b.address ? ([[t("booking.exactAddress"), b.address.address]] as [string, React.ReactNode][]) : []),
    [
      t("booking.stay"),
      t("booking.stayLine", {
        from: formatDate(b.check_in, locale, "long"),
        to: formatDate(b.check_out, locale, "long"),
        nights: b.nights,
      }),
    ],
    ...(b.address
      ? ([
          [
            "",
            t("booking.checkTimes", {
              in: formatClock(b.address.check_in_time, locale),
              out: formatClock(b.address.check_out_time, locale),
            }),
          ],
        ] as [string, React.ReactNode][])
      : []),
    [t("booking.guestsCount"), t("booking.guestsLine", { count: b.adults + b.children })],
  ];

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-6">
      <section role="status" className="no-print grid justify-items-center gap-2 text-center">
        <CircleCheckIcon className="size-14 text-primary" aria-hidden />
        <h1 className="text-2xl font-bold">{t("booking.successTitle")}</h1>
        <p className="text-muted-foreground">{t("booking.successText")}</p>
      </section>

      <article
        aria-labelledby="receipt-title"
        className="receipt grid gap-5 rounded-2xl border bg-card p-6 shadow-sm"
      >
        <header className="flex items-center justify-between gap-4 border-b pb-4">
          <div className="flex items-center gap-2 text-lg font-extrabold text-primary">
            <LogoMark />
            {t("common.siteName")}
          </div>
          <h2 id="receipt-title" className="text-xl font-bold">
            {t("booking.receiptTitle")}
          </h2>
        </header>
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
          {rows.map(([label, value], i) => (
            <div key={i} className="contents">
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="m-0">{value}</dd>
            </div>
          ))}
        </dl>
        <PriceBreakdown
          pricePerNight={b.nightly_price}
          cleaningFee={b.cleaning_fee}
          currency={b.currency}
          checkIn={b.check_in}
          checkOut={b.check_out}
        />
        <p className="flex items-baseline justify-between gap-4 border-t pt-4 text-lg font-bold">
          <span>{t("booking.amountPaid")}</span>
          <span>{money(b.total_price, b.currency)}</span>
        </p>
        <p className="text-xs text-muted-foreground">{t("booking.receiptNote")}</p>
      </article>

      <div className="no-print flex flex-wrap gap-3">
        <Button size="lg" onClick={() => window.print()}>
          <PrinterIcon aria-hidden />
          {t("booking.printReceipt")}
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href={trip}>{t("booking.viewTrip")}</Link>
        </Button>
      </div>
    </div>
  );
}
