"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/navigation";
import { canReview } from "@/lib/bookingView";
import { errorCode, errorMessage, type Translate } from "@/lib/errors";

const DETAILS = ["cleanliness", "accuracy", "check_in", "communication", "location", "value"] as const;
type Detail = (typeof DETAILS)[number];

/** Remembers, for this tab, stays that already have a review: the API has no field that says so (data-model). */
export const reviewedKey = (bookingId: number) => ["reviewed", bookingId] as const;

/**
 * A review after a completed stay (FR-031, US5): the overall rating (required), six detailed ratings
 * (optional, as in the API) and a text of 1 to 5000 characters. Missing parts get a message next to them and
 * nothing is sent (US5/AC3).
 */
export function ReviewForm({ bookingId }: { bookingId: number }) {
  const t = useTranslations();
  const router = useRouter();
  const queryClient = useQueryClient();
  const commentId = useId();
  const [rating, setRating] = useState<number | null>(null);
  const [details, setDetails] = useState<Partial<Record<Detail, number>>>({});
  const [comment, setComment] = useState("");
  const [errors, setErrors] = useState<{ rating?: string; comment?: string }>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
  if (!booking.data) return <Skeleton className="h-64 w-full" />;
  const b = booking.data;
  if (!canReview(b) || queryClient.getQueryData(reviewedKey(bookingId))) {
    // After the API said the stay already has a review, its own message stays on the page.
    return (
      <p role={problem ? "alert" : "status"} className="rounded-lg border p-4">
        {problem ?? t("review.notAllowed")}
      </p>
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const found: typeof errors = {};
    if (!rating) found.rating = t("review.required");
    if (!comment.trim()) found.comment = t("review.commentRequired");
    setErrors(found);
    if (Object.keys(found).length || !rating) return;
    setBusy(true);
    setProblem(null);
    const body = {
      rating,
      comment: comment.trim(),
      ...Object.fromEntries(Object.entries(details).map(([k, v]) => [`${k}_rating`, v])),
    };
    const result = await api.POST("/api/v1/bookings/{booking_id}/review", {
      params: { path: { booking_id: bookingId } },
      body,
    });
    setBusy(false);
    if (result.data) {
      queryClient.setQueryData(reviewedKey(bookingId), true);
      void queryClient.invalidateQueries({ queryKey: ["reviews", b.listing.id] });
      toast.success(t("review.posted"));
      router.push(`/listings/${b.listing.id}`);
    } else {
      if (errorCode(result.error) === "already_reviewed")
        queryClient.setQueryData(reviewedKey(bookingId), true);
      setProblem(errorMessage(t as unknown as Translate, result.error));
    }
  }

  return (
    <form onSubmit={submit} noValidate className="grid max-w-xl gap-6">
      <h1 className="text-2xl font-bold">{t("review.title", { title: b.listing.title })}</h1>
      {problem ? (
        <p role="alert" className="rounded-lg border border-destructive p-3 text-sm text-destructive">
          {problem}
        </p>
      ) : null}
      <Stars legend={t("review.overall")} value={rating} onChange={setRating} error={errors.rating} />
      <fieldset className="grid gap-3">
        <legend className="mb-1 font-semibold">{t("review.details")}</legend>
        {DETAILS.map((key) => (
          <Stars
            key={key}
            small
            legend={t(`listing.${key === "location" ? "location_rating" : key}`)}
            value={details[key] ?? null}
            onChange={(v) => setDetails((d) => ({ ...d, [key]: v }))}
          />
        ))}
      </fieldset>
      <div className="grid gap-1.5">
        <label htmlFor={commentId} className="font-semibold">
          {t("review.comment")}
        </label>
        <Textarea
          id={commentId}
          rows={5}
          maxLength={5000}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          aria-invalid={errors.comment ? true : undefined}
          aria-describedby={`${commentId}-hint${errors.comment ? ` ${commentId}-error` : ""}`}
          className="p-3"
        />
        <p id={`${commentId}-hint`} className="text-sm text-muted-foreground">
          {t("review.commentHint")}
        </p>
        {errors.comment ? (
          <p id={`${commentId}-error`} role="alert" className="text-sm text-destructive">
            {errors.comment}
          </p>
        ) : null}
      </div>
      <Button type="submit" size="lg" disabled={busy}>
        {t("review.submit")}
      </Button>
    </form>
  );
}

/** One rating, 1 to 5, as a group of radio buttons: arrow keys move, and each choice is read aloud. */
function Stars({
  legend,
  value,
  onChange,
  error,
  small,
}: {
  legend: string;
  value: number | null;
  onChange: (v: number) => void;
  error?: string;
  small?: boolean;
}) {
  const t = useTranslations("review");
  const name = useId();
  return (
    <fieldset className="grid gap-1" aria-invalid={error ? true : undefined}>
      <legend id={name} className={small ? "text-sm" : "font-semibold"}>
        {legend}
      </legend>
      <RadioGroup
        aria-labelledby={name}
        value={value === null ? "" : String(value)}
        onValueChange={(v) => onChange(Number(v))}
        className="flex gap-1"
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <RadioGroupItem
            key={n}
            value={String(n)}
            aria-label={t("stars", { count: n })}
            className={`grid size-10 cursor-pointer place-content-center rounded-md border text-lg ${value !== null && n <= value ? "bg-primary text-primary-foreground" : "bg-card"}`}
          >
            <span aria-hidden>★</span>
          </RadioGroupItem>
        ))}
      </RadioGroup>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
