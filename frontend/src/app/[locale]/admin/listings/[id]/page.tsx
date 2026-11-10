import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AdminReview } from "@/components/admin/AdminReview";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: "admin" });
  return { title: t("review") };
}

export default async function AdminReviewPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const listingId = Number(id);
  if (!Number.isInteger(listingId) || listingId < 1) notFound();
  return <AdminReview id={listingId} />;
}
