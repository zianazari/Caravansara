import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { ListingWizard } from "@/components/host/ListingWizard";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "wizard" });
  return { title: t("title"), robots: { index: false } };
}

/** A new listing, step by step (specs/008-host-pages, US1). Any signed-in user can become a host. */
export default async function NewListingPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return (
    <Suspense>
      <RequireAuth>
        <ListingWizard />
      </RequireAuth>
    </Suspense>
  );
}
