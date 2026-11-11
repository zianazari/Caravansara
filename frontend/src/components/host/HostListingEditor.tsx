"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { StarIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import type { components } from "@/api/schema";
import { api } from "@/api/client";
import { ArchFrame } from "@/components/brand/ArchFrame";
import { ReviewList } from "@/components/listing/ReviewList";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMe } from "@/hooks/useAuth";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { errorMessage, type Translate } from "@/lib/errors";
import type { ListingDraft } from "@/lib/listingDraft";
import { apiFieldProblems, STEPS, toListingCreate, validateStep } from "@/lib/listingForm";
import { hasFewPhotos, statusOf } from "@/lib/listingStatus";
import { rialToToman } from "@/lib/money";
import { cityName } from "@/lib/names";
import { needsReview } from "@/lib/reviewFields";
import { HostBookings } from "./HostBookings";
import { PhotoManager } from "./PhotoManager";
import { ReviewWarningDialog } from "./ReviewWarningDialog";
import { FewPhotosBadge, StatusBadge } from "./StatusBadge";
import { AmenitiesStep } from "./steps/AmenitiesStep";
import { CapacityStep } from "./steps/CapacityStep";
import { DescriptionStep } from "./steps/DescriptionStep";
import { LocationStep } from "./steps/LocationStep";
import { PriceStep } from "./steps/PriceStep";
import { TimesStep } from "./steps/TimesStep";
import { TypeStep } from "./steps/TypeStep";
import { hostListingKey, useHostListing } from "./useHostListing";

type Listing = components["schemas"]["ListingOut"];
const TABS = ["details", "photos", "bookings", "reviews"] as const;
type Tab = (typeof TABS)[number];

/** A stored amount as the host types it: toman for rial, without trailing zeros (research R7). */
function typed(amount: string, currency: string): string {
  const value = currency === "IRR" ? rialToToman(amount) : amount;
  return value.includes(".") ? value.replace(/\.?0+$/, "") : value;
}

/** The form's answers for a stored listing: the same shape as the new-listing draft, so the steps are reused. */
export function draftOf(l: Listing, cityLabel: string): ListingDraft {
  return {
    property_type: l.property_type,
    city_id: l.city.id,
    city_label: cityLabel,
    country_code: l.city.country.code,
    neighborhood: l.neighborhood ?? "",
    address: l.private_location?.address ?? "",
    latitude: l.private_location?.latitude,
    longitude: l.private_location?.longitude,
    max_guests: l.max_guests,
    bedrooms: l.bedrooms,
    beds: l.beds,
    bathrooms: Number(l.bathrooms),
    pets_allowed: l.pets_allowed,
    max_pets: l.max_pets,
    amenity_ids: l.amenities.flatMap((group) => group.amenities.map((a) => a.id)),
    title: l.title,
    description: l.description ?? "",
    currency: l.currency,
    price_per_night: typed(l.price_per_night, l.currency),
    cleaning_fee: typed(l.cleaning_fee, l.currency),
    check_in_time: l.check_in_time.slice(0, 5),
    check_out_time: l.check_out_time.slice(0, 5),
  };
}

/**
 * One of the host's listings (specs/008-host-pages, US3, US4): its status with the reason of a rejection and
 * "send again", the switch that shows or hides it in search, and four tabs in ?tab=: details (the steps of
 * the new-listing form, with the review warning of R8), photos, bookings and reviews. Another user's listing,
 * or one that does not exist, shows "not found" (R12); the API refuses every host action for it anyway. After
 * every save the listing is read again, so a decision the admin made in the meantime is shown (analyze L2).
 */
export function HostListingEditor({
  id,
  loadMap,
}: {
  id: number;
  loadMap?: () => Promise<typeof import("maplibre-gl")>;
}) {
  const t = useTranslations();
  const me = useMe();
  const detail = useHostListing(id);
  const client = useQueryClient();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const asked = params.get("tab") as Tab | null;
  const tab: Tab = asked && TABS.includes(asked) ? asked : "details";

  if (detail.isPending || (detail.data && me.isPending)) return <Skeleton className="h-96 w-full" />;
  const listing = detail.data;
  if (!listing || (me.data && listing.host.id !== me.data.id)) {
    return (
      <div className="grid justify-items-start gap-3 rounded-2xl border bg-surface p-6">
        <h1 className="text-xl font-semibold">{t("common.notFoundTitle")}</h1>
        <p className="text-muted-foreground">{t("common.notFoundText")}</p>
        <Button asChild className="rounded-full">
          <Link href="/host">{t("host.title")}</Link>
        </Button>
      </div>
    );
  }

  const refresh = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: hostListingKey(id) }),
      client.invalidateQueries({ queryKey: ["me", "listings"] }),
    ]);

  return (
    <div className="grid gap-6">
      <ListingHeader listing={listing} onSaved={refresh} />
      {/* shadcn/ui Tabs (feature 026); the chosen tab stays in the address (?tab=). On a phone the row scrolls
          sideways with a thin scroll bar. */}
      <Tabs
        value={tab}
        onValueChange={(key) => router.replace(`${pathname}?tab=${key}`)}
        className="grid gap-6"
      >
        <ScrollArea orientation="horizontal">
          <TabsList aria-label={t("host.tabs")} className="w-max min-w-full pb-px">
            {TABS.map((key) => (
              <TabsTrigger key={key} value={key}>
                {t(`host.tab_${key}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </ScrollArea>
        <TabsContent value="details">
          <DetailsForm key={detail.dataUpdatedAt} listing={listing} onSaved={refresh} loadMap={loadMap} />
        </TabsContent>
        <TabsContent value="photos">
          <PhotoManager
            listingId={id}
            photos={listing.photos}
            reviewStatus={listing.review?.status ?? "approved"}
            onChange={() => void refresh()}
          />
        </TabsContent>
        <TabsContent value="bookings">
          <HostBookings listingId={id} />
        </TabsContent>
        <TabsContent value="reviews">
          <HostReviews listing={listing} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ListingHeader({ listing, onSaved }: { listing: Listing; onSaved: () => Promise<unknown> }) {
  const t = useTranslations();
  const status = statusOf(listing);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string>();
  const tr = t as unknown as Translate;

  async function run(action: () => Promise<{ data?: unknown; error?: unknown }>, done: string) {
    setBusy(true);
    setProblem(undefined);
    try {
      const { data, error } = await action();
      if (data) toast.success(done);
      else setProblem(errorMessage(tr, error));
      await onSaved();
    } finally {
      setBusy(false);
    }
  }
  const path = { params: { path: { listing_id: listing.id } } };

  return (
    <header className="grid gap-4 sm:grid-cols-[10rem_1fr] sm:items-start">
      <ArchFrame src={listing.photos[0]?.url} alt="" sizes="160px" className="aspect-[4/5] w-32 sm:w-40" />
      <div className="grid gap-3">
        <div className="flex flex-wrap gap-1.5">
          <StatusBadge status={status} />
          {hasFewPhotos(listing) ? <FewPhotosBadge /> : null}
        </div>
        <h1 className="text-2xl font-bold">{listing.title}</h1>
        {status === "pending" ? (
          <p className="text-sm text-muted-foreground">{t("host.pendingNote")}</p>
        ) : null}
        {status === "rejected" ? (
          <div className="grid justify-items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3">
            {listing.review?.rejection_reason ? (
              <p className="text-sm">
                {t("host.rejectionReason", { reason: listing.review.rejection_reason })}
              </p>
            ) : null}
            <p className="text-sm text-muted-foreground">{t("host.rejectedNote")}</p>
            <Button
              type="button"
              size="sm"
              className="rounded-full"
              disabled={busy}
              onClick={() =>
                void run(
                  () => api.POST("/api/v1/listings/{listing_id}/resubmit", path),
                  t("host.resubmitted"),
                )
              }
            >
              {t("host.resubmit")}
            </Button>
          </div>
        ) : null}
        <label className="flex items-center gap-3">
          <Checkbox
            checked={listing.is_active}
            disabled={busy}
            onCheckedChange={(on) =>
              void run(
                () =>
                  api.PATCH("/api/v1/listings/{listing_id}", { ...path, body: { is_active: on === true } }),
                on === true ? t("host.activated") : t("host.deactivated"),
              )
            }
          />
          <span>{t("host.showInSearch")}</span>
        </label>
        {!listing.is_active ? (
          <p className="text-sm text-muted-foreground">{t("host.inactiveNote")}</p>
        ) : null}
        {status === "active" ? (
          <Button asChild variant="soft" size="sm" className="justify-self-start">
            <Link href={`/listings/${listing.id}`}>{t("host.viewPublic")}</Link>
          </Button>
        ) : null}
        {problem ? (
          <p role="alert" className="text-sm text-destructive">
            {problem}
          </p>
        ) : null}
      </div>
    </header>
  );
}

function same(a: unknown, b: unknown): boolean {
  const norm = (v: unknown) => (Array.isArray(v) ? [...v].sort().join(",") : JSON.stringify(v ?? null));
  return norm(a) === norm(b);
}

function DetailsForm({
  listing,
  onSaved,
  loadMap,
}: {
  listing: Listing;
  onSaved: () => Promise<unknown>;
  loadMap?: () => Promise<typeof import("maplibre-gl")>;
}) {
  const t = useTranslations();
  const tr = t as unknown as Translate;
  const [initial] = useState(() => draftOf(listing, cityName(t, listing.city.name)));
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState<string>();
  const [asking, setAsking] = useState(false);
  const [saving, setSaving] = useState(false);

  const change = (changes: ListingDraft) => {
    setDraft((d) => ({ ...d, ...changes }));
    setErrors((current) => {
      const next = { ...current };
      for (const field of Object.keys(changes)) delete next[field];
      return next;
    });
  };

  function check(): boolean {
    const all = Object.assign({}, ...STEPS.map((step) => validateStep(step, draft)));
    setErrors(
      Object.fromEntries(
        Object.entries(all).map(([field, p]) => {
          const problem = p as { key: string; values?: Record<string, number> };
          return [field, t(`wizard.${problem.key}`, problem.values)];
        }),
      ),
    );
    return Object.keys(all).length === 0;
  }

  const before = toListingCreate(initial);
  let after: ReturnType<typeof toListingCreate> | null = null;
  try {
    after = toListingCreate(draft);
  } catch {
    after = null; // a price that is not a number yet: nothing to compare until it is
  }
  const changed = after
    ? (Object.keys(after) as (keyof typeof after)[]).filter((field) => !same(before[field], after![field]))
    : [];
  const dirty = !after || changed.length > 0;

  function save() {
    if (!check() || !after) return;
    if (changed.length === 0) return;
    if (needsReview(listing.review?.status ?? "approved", before, after)) setAsking(true);
    else void send();
  }

  async function send() {
    setAsking(false);
    if (!after) return;
    setSaving(true);
    setProblem(undefined);
    const path = { params: { path: { listing_id: listing.id } } };
    try {
      const fields = changed.filter((field) => field !== "amenity_ids");
      if (fields.length > 0) {
        const body = Object.fromEntries(fields.map((field) => [field, after![field]]));
        const { error } = await api.PATCH("/api/v1/listings/{listing_id}", { ...path, body });
        if (error) return fail(error);
      }
      if (changed.includes("amenity_ids")) {
        const { error } = await api.PUT("/api/v1/listings/{listing_id}/amenities", {
          ...path,
          body: { amenity_ids: after.amenity_ids ?? [] },
        });
        if (error) return fail(error);
      }
      toast.success(t("host.saved"));
    } finally {
      setSaving(false);
      await onSaved();
    }
  }

  function fail(error: unknown) {
    const fields = apiFieldProblems(error);
    setErrors(
      Object.fromEntries(
        Object.entries(fields).map(([field, type]) => {
          const key = `validation.${type}`;
          return [field, tr.has(key) ? tr(key) : tr("validation.invalid")];
        }),
      ),
    );
    setProblem(errorMessage(tr, error));
  }

  const props = { draft, onChange: change, errors };
  const section = (name: (typeof STEPS)[number], body: React.ReactNode) => (
    <section aria-labelledby={`edit-${name}`} className="grid gap-4 border-b pb-8">
      <h2 id={`edit-${name}`} className="text-lg font-semibold">
        {t(`wizard.step_${name}`)}
      </h2>
      {body}
    </section>
  );
  return (
    <form
      noValidate
      className="grid max-w-2xl gap-8"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      {section("type", <TypeStep {...props} />)}
      {section("location", <LocationStep {...props} loadMap={loadMap} />)}
      {section("capacity", <CapacityStep {...props} />)}
      {section("amenities", <AmenitiesStep {...props} />)}
      {section("description", <DescriptionStep {...props} />)}
      {section("price", <PriceStep {...props} />)}
      {section("times", <TimesStep {...props} />)}
      {problem ? (
        <p role="alert" className="text-sm text-destructive">
          {problem}
        </p>
      ) : null}
      <Button type="submit" className="justify-self-start rounded-full" disabled={saving || !dirty}>
        {t("host.save")}
      </Button>
      <ReviewWarningDialog open={asking} onConfirm={() => void send()} onCancel={() => setAsking(false)} />
    </form>
  );
}

function HostReviews({ listing }: { listing: Listing }) {
  const t = useTranslations("listing");
  const locale = useLocale();
  const first = useQuery({
    queryKey: ["reviews-first", listing.id],
    queryFn: async () => {
      const { data } = await api.GET("/api/v1/listings/{listing_id}/reviews", {
        params: { path: { listing_id: listing.id }, query: { limit: 10, offset: 0 } },
      });
      return data ?? { items: [], total: 0 };
    },
  });
  if (!first.data) return <Skeleton className="h-40 w-full" />;
  const n = (x: number) => new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en").format(x);
  return (
    <div className="grid gap-4">
      {listing.avg_rating ? (
        <p className="flex items-center gap-1.5 text-lg font-semibold">
          <StarIcon className="size-5 fill-current text-gold" aria-hidden />
          {n(Number(listing.avg_rating))} · {t("reviews")} ({n(listing.review_count)})
        </p>
      ) : null}
      <ReviewList listingId={listing.id} first={first.data} />
    </div>
  );
}
