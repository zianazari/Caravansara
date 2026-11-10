import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { HostListings } from "@/components/host/HostListings";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "host" });
  return { title: t("title"), robots: { index: false } };
}

/** The host's listings (specs/008-host-pages, US3). */
export default async function HostPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  const t = await getTranslations("host");
  return (
    <div className="grid gap-6" data-wide>
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <Suspense>
        <RequireAuth>
          <HostListings />
        </RequireAuth>
      </Suspense>
    </div>
  );
}
