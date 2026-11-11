import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { AdminQueue } from "@/components/admin/AdminQueue";
import { Skeleton } from "@/components/ui/skeleton";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: "admin" });
  return { title: t("queueTitle") };
}

export default async function AdminQueuePage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  // The queue reads its page and order from the address bar (feature 025), which needs a Suspense boundary.
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <AdminQueue />
    </Suspense>
  );
}
