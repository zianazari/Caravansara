"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import type { components } from "@/api/schema";
import { adminApi } from "@/api/adminClient";
import { ArchFrame } from "@/components/brand/ArchFrame";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useMoney } from "@/hooks/useMoney";
import { Link, useRouter } from "@/i18n/navigation";
import { formatClock } from "@/lib/cityTime";
import { errorCode, errorMessage, type Translate } from "@/lib/errors";
import { amenityName, cityName, countryName } from "@/lib/names";
import { ExactMap } from "./ExactMap";
import { MIN_PHOTOS } from "@/lib/listingStatus";
import { AdminRequestError, useAdminGate } from "./useAdminGate";

type Listing = components["schemas"]["AdminListingOut"];
const REASON_MAX = 1000; // RejectIn.reason

/**
 * One listing in review (feature 009): everything the host wrote, the photos, and the exact address and point,
 * which only the admin sees here and the API records. The decision is sent with the `review_version` seen on
 * this page; if the host changed the listing in the meantime, the API answers 409 listing_changed and the page
 * shows the new version, so the admin never approves something they have not seen.
 */
export function AdminReview({
  id,
  loadMap,
}: {
  id: number;
  loadMap?: () => Promise<typeof import("maplibre-gl")>;
}) {
  const t = useTranslations();
  const tr = t as unknown as Translate;
  const locale = useLocale();
  const money = useMoney();
  const router = useRouter();
  const client = useQueryClient();
  const [problem, setProblem] = useState<string>();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const listing = useQuery({
    queryKey: ["admin", "listing", id],
    retry: false,
    queryFn: async (): Promise<Listing | null> => {
      const { data, error, response } = await adminApi.GET("/api/v1/admin/listings/{listing_id}", {
        params: { path: { listing_id: id } },
      });
      if (data) return data;
      if (response.status === 404) return null;
      throw new AdminRequestError(response.status, error);
    },
  });
  useAdminGate(listing.error instanceof AdminRequestError ? listing.error.status : undefined);

  if (listing.isPending) return <Skeleton className="h-96 w-full" />;
  if (listing.isError) {
    return (
      <p role="alert" className="text-destructive">
        {t("common.errorText")}
      </p>
    );
  }
  const l = listing.data;
  if (!l) {
    return (
      <div className="grid justify-items-start gap-3">
        <h1 className="text-xl font-semibold">{t("common.notFoundTitle")}</h1>
        <Link href="/admin" className="text-primary underline">
          {t("admin.backToQueue")}
        </Link>
      </div>
    );
  }

  async function decide(kind: "approve" | "reject") {
    setBusy(true);
    setProblem(undefined);
    try {
      const path = { params: { path: { listing_id: id } } };
      const { data, error, response } =
        kind === "approve"
          ? await adminApi.POST("/api/v1/admin/listings/{listing_id}/approve", {
              ...path,
              body: { review_version: l!.review_version },
            })
          : await adminApi.POST("/api/v1/admin/listings/{listing_id}/reject", {
              ...path,
              body: { review_version: l!.review_version, reason: reason.trim() },
            });
      if (response.status === 401) return router.replace("/admin/login?ended=1");
      if (data) {
        toast.success(t(kind === "approve" ? "admin.approved" : "admin.rejected"));
        await client.invalidateQueries({ queryKey: ["admin", "queue"] });
        router.push("/admin");
        return;
      }
      setRejecting(false);
      const code = errorCode(error);
      if (code === "listing_changed") {
        setProblem(t("admin.changed"));
        await listing.refetch();
      } else if (code === "listing_not_pending") {
        setProblem(t("admin.notPending"));
      } else {
        setProblem(errorMessage(tr, error));
      }
    } finally {
      setBusy(false);
    }
  }

  function confirmReject() {
    const text = reason.trim();
    if (!text) return setReasonError(t("admin.reasonRequired"));
    if (text.length > REASON_MAX) return setReasonError(t("wizard.tooLong", { max: REASON_MAX }));
    setReasonError(undefined);
    void decide("reject");
  }

  const n = (x: number | string) => new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en").format(Number(x));
  const amenities = l.amenities.flatMap((group) => group.amenities);
  return (
    <div className="grid gap-6">
      <Link href="/admin" className="text-sm text-primary underline">
        {t("admin.backToQueue")}
      </Link>
      <header className="grid gap-1">
        <h1 className="text-2xl font-bold">{l.title}</h1>
        <p className="text-muted-foreground">
          {t(`propertyTypes.${l.property_type}`)} · {cityName(t, l.city.name)}
          {locale === "fa" ? "، " : ", "}
          {countryName(l.city.country.code, locale)}
          {" · "}
          {t("admin.hostName", { name: l.host.full_name })}
        </p>
      </header>

      {problem ? (
        <p
          role="alert"
          className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {problem}
        </p>
      ) : null}

      <section aria-labelledby="admin-photos" className="grid gap-3">
        <h2 id="admin-photos" className="text-lg font-semibold">
          {t("listing.photos")}{" "}
          <span className="text-sm font-normal text-muted-foreground">
            ({t("admin.photosCount", { count: l.photos.length })})
          </span>
        </h2>
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[...l.photos]
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((p, i) => (
              <li key={p.id} className="grid gap-1">
                <ArchFrame
                  src={p.url}
                  alt={p.caption ?? p.room_tag ?? t("photos.photo", { index: i + 1 })}
                  sizes="(min-width: 768px) 25vw, 50vw"
                  className="aspect-[4/5] w-full"
                />
                {p.room_tag || p.caption ? (
                  <p className="text-xs text-muted-foreground">
                    {[p.room_tag, p.caption].filter(Boolean).join(" · ")}
                  </p>
                ) : null}
              </li>
            ))}
        </ul>
      </section>

      <section aria-labelledby="admin-details" className="grid gap-2">
        <h2 id="admin-details" className="text-lg font-semibold">
          {t("admin.details")}
        </h2>
        <p>
          {t("admin.capacity", {
            guests: n(l.max_guests),
            bedrooms: n(l.bedrooms),
            beds: n(l.beds),
            bathrooms: n(l.bathrooms),
          })}
        </p>
        <p>{l.pets_allowed ? t("admin.pets", { count: l.max_pets }) : t("admin.noPets")}</p>
        <p>
          {t("admin.price", {
            price: money(l.price_per_night, l.currency),
            fee: money(l.cleaning_fee, l.currency),
          })}
        </p>
        <p>
          {t("admin.times", {
            in: formatClock(l.check_in_time.slice(0, 5), locale),
            out: formatClock(l.check_out_time.slice(0, 5), locale),
          })}
        </p>
        {amenities.length ? (
          <p>{amenities.map((a) => amenityName(t, a.name)).join(locale === "fa" ? "، " : ", ")}</p>
        ) : null}
        {l.description ? <p className="whitespace-pre-line">{l.description}</p> : null}
      </section>

      <section aria-labelledby="admin-place" className="grid gap-2">
        <h2 id="admin-place" className="text-lg font-semibold">
          {t("admin.exactAddress")}
        </h2>
        {l.neighborhood ? <p>{t("listing.neighborhood", { name: l.neighborhood })}</p> : null}
        <p dir="auto" className="font-medium">
          {l.private_location.address}
        </p>
        <p className="text-sm text-muted-foreground">{t("admin.addressLogged")}</p>
        <ExactMap
          latitude={l.private_location.latitude}
          longitude={l.private_location.longitude}
          loadMap={loadMap}
        />
      </section>

      {/* The API refuses to approve a listing with fewer than 3 photos (feature 010); say so before trying. */}
      {l.photos.length < MIN_PHOTOS ? <p className="text-sm font-medium">{t("admin.fewPhotos")}</p> : null}
      <div className="sticky bottom-0 flex gap-3 border-t bg-background py-3">
        <Button
          type="button"
          className="rounded-full"
          disabled={busy || l.photos.length < MIN_PHOTOS}
          onClick={() => void decide("approve")}
        >
          {t("admin.approve")}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="rounded-full"
          disabled={busy}
          onClick={() => setRejecting(true)}
        >
          {t("admin.reject")}
        </Button>
      </div>

      <Dialog open={rejecting} onOpenChange={(open) => setRejecting(open)}>
        <DialogContent closeLabel={t("common.close")}>
          <DialogTitle>{t("admin.rejectTitle")}</DialogTitle>
          <DialogDescription className="sr-only">{t("admin.reason")}</DialogDescription>
          <label htmlFor="reject-reason" className="text-sm font-medium">
            {t("admin.reason")}
          </label>
          <textarea
            id="reject-reason"
            rows={5}
            value={reason}
            aria-invalid={reasonError ? true : undefined}
            aria-describedby={reasonError ? "reject-reason-error" : "reject-reason-count"}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-lg border bg-card px-3 py-2 text-base aria-invalid:border-destructive"
          />
          <p id="reject-reason-count" className="text-sm text-muted-foreground">
            {t("wizard.chars", { count: reason.trim().length, max: REASON_MAX })}
          </p>
          {reasonError ? (
            <p id="reject-reason-error" role="alert" className="text-sm text-destructive">
              {reasonError}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => setRejecting(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="rounded-full"
              disabled={busy}
              onClick={confirmReject}
            >
              {t("admin.confirmReject")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
