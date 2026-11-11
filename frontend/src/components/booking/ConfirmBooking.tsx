"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { api } from "@/api/client";
import { PriceBreakdown } from "@/components/booking/PriceBreakdown";
import { ArchFrame } from "@/components/brand/ArchFrame";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, useRouter } from "@/i18n/navigation";
import { readDraft, rememberBooking } from "@/lib/bookingDraft";
import { formatDate } from "@/lib/calendar";
import { errorCode, errorMessage, type Translate } from "@/lib/errors";
import { stayQuery } from "@/lib/searchParams";

/**
 * Holding the dates (US3/AC1, AC4 to AC6). The request carries the draft's idempotency key, so a second press
 * or a retry after a dropped connection returns the same hold instead of making a second one (FR-025).
 */
export function ConfirmBooking({ listingId }: { listingId: number }) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [draft] = useState(() => readDraft());
  const [problem, setProblem] = useState<{ code: string; text: string } | null>(null);
  const [sending, setSending] = useState(false);
  const usable = draft && draft.listing_id === listingId ? draft : null;

  const listing = useQuery({
    queryKey: ["listing", listingId],
    enabled: usable !== null,
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/listings/{listing_id}", {
        params: { path: { listing_id: listingId } },
      });
      if (!data) throw error;
      return data;
    },
  });

  if (!usable) {
    return (
      <div role="status" className="grid justify-items-start gap-3 rounded-lg border p-4">
        <p>{t("booking.noDraft")}</p>
        <Button asChild variant="soft" size="sm">
          <Link href={`/listings/${listingId}`}>{t("common.back")}</Link>
        </Button>
      </div>
    );
  }
  if (!listing.data) return <Skeleton className="h-48 w-full" />;

  async function hold() {
    if (sending || !usable) return;
    setSending(true);
    setProblem(null);
    const { idempotency_key, listing_id, check_in, check_out, adults, children, infants, pets } = usable;
    const stay = { listing_id, check_in, check_out, adults, children, infants, pets };
    const result = await api.POST("/api/v1/bookings", {
      params: { header: { "Idempotency-Key": idempotency_key } },
      body: stay,
    });
    setSending(false);
    if (result.data) {
      rememberBooking(result.data.id);
      router.replace(`/trips/${result.data.id}`);
    } else {
      setProblem({
        code: errorCode(result.error),
        text: errorMessage(t as unknown as Translate, result.error),
      });
    }
  }

  const guests = usable.adults + usable.children;
  return (
    <div className="mx-auto grid w-full max-w-lg gap-5 rounded-3xl border bg-card p-6 shadow-xl shadow-foreground/5">
      <h1 className="text-2xl font-bold">{t("booking.confirmTitle")}</h1>
      <div className="flex items-start gap-4">
        {/* 007: the cover photo in the lower caravansara arch. */}
        <ArchFrame
          src={[...(listing.data.photos ?? [])].sort((x, y) => x.sort_order - y.sort_order)[0]?.url}
          alt=""
          sizes="96px"
          className="h-24 w-20 shrink-0"
        />
        <div className="grid gap-1">
          <h2 className="font-semibold">{listing.data.title}</h2>
          <p className="text-sm text-muted-foreground">
            {t("booking.checkIn")}: {formatDate(usable.check_in, locale, "long")} · {t("booking.checkOut")}:{" "}
            {formatDate(usable.check_out, locale, "long")} · {t("booking.guestsLine", { count: guests })}
          </p>
        </div>
      </div>
      <PriceBreakdown
        pricePerNight={listing.data.price_per_night}
        cleaningFee={listing.data.cleaning_fee}
        currency={listing.data.currency}
        checkIn={usable.check_in}
        checkOut={usable.check_out}
      />
      <p className="text-sm text-muted-foreground">{t("booking.holdNote")}</p>
      {problem ? (
        <div
          role="alert"
          className="grid gap-2 rounded-lg border border-destructive p-3 text-sm text-destructive"
        >
          <p>{problem.text}</p>
          {problem.code === "dates_unavailable" ? (
            <Button asChild variant="soft" size="sm" className="justify-self-start">
              <Link href={`/listings/${listingId}?${stayQuery(usable).toString()}`}>{t("common.back")}</Link>
            </Button>
          ) : null}
        </div>
      ) : null}
      <Button size="lg" onClick={hold} disabled={sending}>
        {sending ? t("booking.sending") : t("booking.confirm")}
      </Button>
    </div>
  );
}
