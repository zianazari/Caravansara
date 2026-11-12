import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { Receipt } from "@/components/booking/Receipt";

type Props = { params: Promise<{ locale: string; bookingId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "booking" });
  return { title: t("receiptTitle"), robots: { index: false } };
}

/** The payment's success page and printable receipt (feature 047); only the booking's guest and host see it. */
export default async function ReceiptPage({ params }: Props) {
  const { locale, bookingId } = await params;
  setRequestLocale(locale);
  const id = Number(bookingId);
  if (!Number.isInteger(id) || id <= 0) notFound();
  return (
    <Suspense>
      <RequireAuth>
        <Receipt bookingId={id} />
      </RequireAuth>
    </Suspense>
  );
}
