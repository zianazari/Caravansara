import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { HostListingEditor } from "@/components/host/HostListingEditor";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "host" });
  return { title: t("title"), robots: { index: false } };
}

/** One of the host's listings (specs/008-host-pages, US3, US4). It is read in the browser with the host's token. */
export default async function HostListingPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const listingId = Number(id);
  if (!Number.isInteger(listingId) || listingId < 1) notFound();
  return (
    <Suspense>
      <RequireAuth>
        <HostListingEditor id={listingId} />
      </RequireAuth>
    </Suspense>
  );
}
