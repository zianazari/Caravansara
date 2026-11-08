import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { ReviewForm } from "@/components/booking/ReviewForm";

type Props = { params: Promise<{ locale: string; bookingId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "review" });
  return { title: t("submit"), robots: { index: false } };
}

export default async function ReviewPage({ params }: Props) {
  const { locale, bookingId } = await params;
  setRequestLocale(locale);
  const id = Number(bookingId);
  if (!Number.isInteger(id) || id <= 0) notFound();
  return (
    <Suspense>
      <RequireAuth>
        <ReviewForm bookingId={id} />
      </RequireAuth>
    </Suspense>
  );
}
