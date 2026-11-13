"use client";

import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, HouseIcon, SaveIcon } from "lucide-react";
import { cn } from "@/lib/cn";
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
    <div
      className="mx-auto grid max-w-6xl gap-6 pb-24 md:pb-0 lg:grid-cols-[15rem_minmax(0,1fr)]"
      data-listing-studio
    >
      <div className="relative overflow-hidden rounded-3xl border bg-card p-5 sm:p-8 lg:col-span-2">
        <div
          className="pointer-events-none absolute -end-16 -top-24 size-72 rounded-full bg-primary/10 blur-3xl"
          aria-hidden
        />
        <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
          <HouseIcon className="size-4" aria-hidden />
          {t("wizard.title")}
        </p>
        <p className="relative text-2xl font-bold sm:text-3xl">{t("wizard.intro")}</p>
        <p className="relative mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
          {t("wizard.introText")}
        </p>
      </div>
      <aside className="hidden self-start rounded-3xl border bg-card p-4 lg:sticky lg:top-24 lg:block">
        <nav aria-label={t("wizard.title")}>
          <ol className="grid gap-1.5">
            {STEPS.map((key, i) => {
              const current = i + 1 === step;
              const complete = i + 1 < (firstInvalidStep(draft) ?? STEP_COUNT);
              return (
                <li key={key}>
                  <button
                    type="button"
                    disabled={sending || i + 1 > (firstInvalidStep(draft) ?? STEP_COUNT)}
                    aria-current={current ? "step" : undefined}
                    onClick={() => go(i + 1)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl p-3 text-start text-sm transition-colors disabled:opacity-40",
                      current ? "bg-primary/10 font-semibold text-primary" : "hover:bg-muted",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-7 shrink-0 place-items-center rounded-lg border text-xs tabular-nums",
                        current && "border-primary/40",
                        complete && "border-primary/30 bg-primary/10 text-primary",
                      )}
                    >
                      {complete ? <CheckIcon className="size-3.5" aria-hidden /> : i + 1}
                    </span>
                    {t(`wizard.step_${key}`)}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
        <p className="mt-4 flex items-start gap-2 border-t pt-4 text-xs leading-6 text-muted-foreground">
          <SaveIcon className="mt-1 size-3.5 shrink-0" aria-hidden />
          {t("wizard.draftSaved")}
        </p>
      </aside>
      <div className="grid min-w-0 gap-6 rounded-3xl border bg-card p-5 sm:p-8">
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
          <h1 ref={heading} tabIndex={-1} className="text-2xl font-bold outline-none sm:text-3xl">
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
    </div>
  );
}
