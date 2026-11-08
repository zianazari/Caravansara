import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { ConfirmBooking } from "@/components/booking/ConfirmBooking";

type Props = { params: Promise<{ locale: string; listingId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "booking" });
  return { title: t("confirmTitle"), robots: { index: false } };
}

export default async function BookPage({ params }: Props) {
  const { locale, listingId } = await params;
  setRequestLocale(locale);
  const id = Number(listingId);
  if (!Number.isInteger(id) || id <= 0) notFound();
  return (
    <Suspense>
      <RequireAuth>
        <ConfirmBooking listingId={id} />
      </RequireAuth>
    </Suspense>
  );
}
