"use client";

import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import { usePathname, useRouter } from "@/i18n/navigation";
import { errorMessage, type Translate } from "@/lib/errors";
import { clearListingDraft, readListingDraft, saveListingDraft, type ListingDraft } from "@/lib/listingDraft";
import {
  apiFieldProblems,
  DRAFT_DEFAULTS,
  firstInvalidStep,
  STEP_COUNT,
  STEPS,
  stepOfField,
  toListingCreate,
  validateStep,
  type FieldProblem,
} from "@/lib/listingForm";
import { MIN_PHOTOS } from "@/lib/listingStatus";
import { uploadAll, uploadPhoto } from "@/lib/photoUpload";
import type { DraftPhoto } from "./PhotoManager";
import { AmenitiesStep } from "./steps/AmenitiesStep";
import { CapacityStep } from "./steps/CapacityStep";
import { DescriptionStep } from "./steps/DescriptionStep";
import { LocationStep } from "./steps/LocationStep";
import { PhotosStep } from "./steps/PhotosStep";
import { PriceStep } from "./steps/PriceStep";
import { TimesStep } from "./steps/TimesStep";
import { TypeStep } from "./steps/TypeStep";

/**
 * Making a listing, step by step (specs/008-host-pages, US1). The step is in the address (?step=), so the back
 * button and a reload stay on it; the answers are in the tab's draft (lib/listingDraft). Nothing reaches the
 * server before the last step. "Send for review" then makes the listing, sends the photos two at a time and
 * puts them in the host's order (research R3). If a photo fails, the listing stays made and the page offers
 * to send the rest again; the draft remembers the listing, so a reload never makes a second one.
 */
export function ListingWizard({ loadMap }: { loadMap?: () => Promise<typeof import("maplibre-gl")> }) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [draft, setDraft] = useState<ListingDraft>(() => ({ ...DRAFT_DEFAULTS, ...readListingDraft() }));
  const [photos, setPhotos] = useState<DraftPhoto[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [topError, setTopError] = useState<string>();
  const [sending, setSending] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);

  // A step later than the first unfinished one is not shown: its earlier answers are still missing.
  const asked = Math.min(Math.max(Number(params.get("step")) || 1, 1), STEP_COUNT);
  const step = Math.min(asked, firstInvalidStep(draft) ?? STEP_COUNT);
  const name = STEPS[step - 1]!;

  useEffect(() => {
    heading.current?.focus();
  }, [step]);

  const message = (problem: FieldProblem) => t(`wizard.${problem.key}`, problem.values);

  // The stored draft holds only what the host answered; the defaults stay in the page's state, so the
  // state is merged here rather than replaced by what storage returns.
  function change(changes: ListingDraft) {
    saveListingDraft(changes);
    setDraft((current) => ({ ...current, ...changes }));
    setErrors((current) => {
      const next = { ...current };
      for (const field of Object.keys(changes)) delete next[field];
      return next;
    });
  }

  function go(to: number) {
    setTopError(undefined);
    router.push(`${pathname}?step=${to}`);
  }

  function next() {
    const problems = validateStep(name, draft);
    if (Object.keys(problems).length > 0) {
      setErrors(Object.fromEntries(Object.entries(problems).map(([field, p]) => [field, message(p)])));
      return;
    }
    setErrors({});
    go(step + 1);
  }

  function startOver() {
    clearListingDraft();
    for (const photo of photos) URL.revokeObjectURL(photo.preview);
    setPhotos([]);
    setDraft({ ...DRAFT_DEFAULTS });
    setErrors({});
    go(1);
  }

  function setPhoto(key: string, changes: Partial<DraftPhoto>) {
    setPhotos((all) => all.map((p) => (p.key === key ? { ...p, ...changes } : p)));
  }

  async function create(): Promise<number | undefined> {
    if (draft.listing_id) return draft.listing_id;
    const { data, error } = await api.POST("/api/v1/listings", { body: toListingCreate(draft) });
    if (data) {
      saveListingDraft({ listing_id: data.id });
      setDraft((current) => ({ ...current, listing_id: data.id }));
      return data.id;
    }
    const fields = apiFieldProblems(error);
    const known = Object.keys(fields).filter((field) => stepOfField(field) !== undefined);
    if (known.length > 0) {
      const tr = t as unknown as Translate;
      setErrors(
        Object.fromEntries(
          known.map((field) => {
            const key = `validation.${fields[field]}`;
            return [field, tr.has(key) ? tr(key) : tr("validation.invalid")];
          }),
        ),
      );
      setTopError(errorMessage(tr, error));
      router.push(`${pathname}?step=${Math.min(...known.map((field) => stepOfField(field)!))}`);
    } else {
      setTopError(errorMessage(t as unknown as Translate, error));
    }
    return undefined;
  }

  async function submit() {
    setSending(true);
    setTopError(undefined);
    try {
      const listingId = await create();
      if (listingId === undefined) return;
      const waiting = photos.filter((p) => p.status !== "registered");
      for (const p of waiting) setPhoto(p.key, { status: "queued", progress: 0 });
      const results = await uploadAll(waiting, async (p) => {
        setPhoto(p.key, { status: "uploading", progress: 0 });
        const out = await uploadPhoto(
          listingId,
          { file: p.file, room_tag: p.room_tag, caption: p.caption },
          { onProgress: (progress) => setPhoto(p.key, { progress }) },
        );
        setPhoto(p.key, { status: "registered", progress: 1, photo_id: out.id });
        return out.id;
      });
      const ids = new Map(waiting.map((p, i) => [p.key, results[i]!]));
      const failed = [...ids].filter(([, result]) => !result.ok).map(([key]) => key);
      for (const key of failed) setPhoto(key, { status: "failed" });
      if (failed.length > 0) {
        setTopError(t("wizard.photosFailed"));
        return;
      }
      const order = photos.map((p) => {
        const r = ids.get(p.key);
        return r?.ok ? r.value : p.photo_id!;
      });
      await api.PUT("/api/v1/listings/{listing_id}/photos/order", {
        params: { path: { listing_id: listingId } },
        body: { photo_ids: order },
      });
      clearListingDraft();
      for (const photo of photos) URL.revokeObjectURL(photo.preview);
      toast.success(t("wizard.created"));
      router.push(`/host/listings/${listingId}`);
    } finally {
      setSending(false);
    }
  }

  const stepProps = { draft, onChange: change, errors };
  const last = step === STEP_COUNT;
  const fewPhotos = photos.length < MIN_PHOTOS;
  return (
    <div className="mx-auto grid max-w-2xl gap-6 pb-24 md:pb-0">
      <header className="grid gap-3">
        <p className="text-sm text-muted-foreground">{t("wizard.stepOf", { step, total: STEP_COUNT })}</p>
        <div
          role="progressbar"
          aria-label={t("wizard.title")}
          aria-valuemin={1}
          aria-valuemax={STEP_COUNT}
          aria-valuenow={step}
          className="h-1.5 overflow-hidden rounded-full bg-muted"
        >
          <span
            className="block h-full bg-primary transition-[width]"
            style={{ width: `${(step / STEP_COUNT) * 100}%` }}
          />
        </div>
        <h1 ref={heading} tabIndex={-1} className="text-2xl font-bold outline-none">
          {t(`wizard.step_${name}`)}
        </h1>
      </header>

      {topError ? (
        <p
          role="alert"
          className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {topError}
        </p>
      ) : null}

      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (last) void submit();
          else next();
        }}
        className="grid gap-6"
      >
        {name === "type" ? <TypeStep {...stepProps} /> : null}
        {name === "location" ? <LocationStep {...stepProps} loadMap={loadMap} /> : null}
        {name === "capacity" ? <CapacityStep {...stepProps} /> : null}
        {name === "amenities" ? <AmenitiesStep {...stepProps} /> : null}
        {name === "description" ? <DescriptionStep {...stepProps} /> : null}
        {name === "price" ? <PriceStep {...stepProps} /> : null}
        {name === "times" ? <TimesStep {...stepProps} /> : null}
        {name === "photos" ? (
          <PhotosStep
            items={photos}
            onItems={setPhotos}
            onRetry={sending ? undefined : () => void submit()}
          />
        ) : null}

        <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t bg-card px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:static md:border-0 md:bg-transparent md:p-0">
          {step > 1 ? (
            <Button type="button" variant="outline" className="rounded-full" onClick={() => go(step - 1)}>
              <ArrowRightIcon className="ltr:rotate-180" aria-hidden />
              {t("wizard.back")}
            </Button>
          ) : null}
          <Button type="button" variant="ghost" className="me-auto rounded-full" onClick={startOver}>
            {t("wizard.startOver")}
          </Button>
          <Button type="submit" className="rounded-full" disabled={sending || (last && fewPhotos)}>
            {last ? (sending ? t("wizard.submitting") : t("wizard.submit")) : t("wizard.next")}
            {last ? null : <ArrowLeftIcon className="ltr:rotate-180" aria-hidden />}
          </Button>
        </div>
      </form>
    </div>
  );
}
