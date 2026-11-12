import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { Skeleton } from "@/components/ui/skeleton";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: "admin" });
  return { title: t("title") };
}

export default async function AdminPanelPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  // The panel reads its tab, filters and page from the address bar (features 025, 051), which needs a Suspense
  // boundary.
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <AdminPanel />
    </Suspense>
  );
}
