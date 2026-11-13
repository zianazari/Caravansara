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
    <div className="mx-auto grid max-w-7xl gap-6" data-host-workspace>
      <header className="relative overflow-hidden rounded-3xl border bg-card p-6 sm:p-9">
        <div
          className="pointer-events-none absolute -end-20 -top-24 size-80 rounded-full bg-primary/10 blur-3xl"
          aria-hidden
        />
        <p className="mb-3 text-sm font-semibold text-primary">{t("workspace")}</p>
        <h1 className="relative text-3xl font-bold sm:text-4xl">{t("title")}</h1>
        <p className="relative mt-4 max-w-2xl leading-8 text-muted-foreground">{t("workspaceIntro")}</p>
      </header>
      <Suspense>
        <RequireAuth>
          <HostListings />
        </RequireAuth>
      </Suspense>
    </div>
  );
}
