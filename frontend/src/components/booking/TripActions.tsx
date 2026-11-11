"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { canReview } from "@/lib/bookingView";
import { CancelDialog } from "./CancelDialog";
import { reviewedKey } from "./ReviewForm";
import { TripDetail } from "./TripDetail";

/** The trip page: the booking itself, cancelling (US4) and the way to a review (US5). */
export function TripActions({ bookingId }: { bookingId: number }) {
  const t = useTranslations("trips");
  const queryClient = useQueryClient();
  return (
    <TripDetail bookingId={bookingId}>
      {(booking) => (
        <>
          <CancelDialog booking={booking} />
          {canReview(booking) && !queryClient.getQueryData(reviewedKey(booking.id)) ? (
            <Button asChild variant="soft" size="sm" className="justify-self-start">
              <Link href={`/trips/${booking.id}/review`}>{t("review")}</Link>
            </Button>
          ) : null}
        </>
      )}
    </TripDetail>
  );
}
