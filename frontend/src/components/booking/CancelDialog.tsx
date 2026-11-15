"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cancelDeadline, canCancel } from "@/lib/bookingView";
import { formatDate } from "@/lib/calendar";
import { errorCode, errorMessage, type Translate } from "@/lib/errors";
import { cityName } from "@/lib/names";
import type { Booking } from "./TripDetail";

/**
 * Cancelling (FR-030, US4/AC2 to AC4): offered only for a pending or confirmed booking before its check-in day
 * in the listing's city, with the last day shown and a second confirmation. If the state changed meanwhile,
 * the API's answer is shown in plain words.
 */
export function CancelDialog({
  booking: b,
  audience = "guest",
}: {
  booking: Booking;
  audience?: "guest" | "host";
}) {
  const t = useTranslations();
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!(b.can_cancel ?? canCancel(b))) return null;

  const city = cityName(t, b.listing.city);
  const lastDay = formatDate(
    new Intl.DateTimeFormat("en-CA", { timeZone: b.listing.timezone }).format(cancelDeadline(b)),
    locale,
    "long",
  );

  async function cancel() {
    if (busy) return;
    setBusy(true);
    setProblem(null);
    try {
      const result = await api.POST("/api/v1/bookings/{booking_id}/cancel", {
        params: { path: { booking_id: b.id } },
      });
      if (result.data) {
        queryClient.setQueryData(["booking", b.id], result.data);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["trips"] }),
          queryClient.invalidateQueries({ queryKey: ["host-bookings", b.listing.id] }),
        ]);
        setOpen(false);
        toast.success(t("trips.cancelled"));
      } else {
        setProblem(
          errorCode(result.error) === "invalid_booking_state"
            ? t("trips.notCancellable")
            : errorMessage(t as unknown as Translate, result.error),
        );
      }
    } catch {
      setProblem(t("errors.service_unavailable"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid gap-2">
      <p className="text-sm text-muted-foreground">{t("trips.cancelDeadline", { date: lastDay, city })}</p>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!busy) {
            setProblem(null);
            setOpen(next);
          }
        }}
      >
        <DialogTrigger asChild>
          <Button variant="outline" className="justify-self-start">
            {t("trips.cancel")}
          </Button>
        </DialogTrigger>
        <DialogContent closeLabel={t("common.close")}>
          <DialogTitle>{t("trips.cancelTitle")}</DialogTitle>
          <DialogDescription>
            {t(audience === "host" ? "host.cancelBookingNote" : "trips.cancelNote")}
          </DialogDescription>
          {problem ? (
            <p role="alert" className="text-sm text-destructive">
              {problem}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="ghost" disabled={busy}>
                {t("trips.keep")}
              </Button>
            </DialogClose>
            <Button variant="destructive" onClick={cancel} disabled={busy}>
              {t("trips.cancelConfirm")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
