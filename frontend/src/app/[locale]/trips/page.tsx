import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { TripList } from "@/components/booking/TripList";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "trips" });
  return { title: t("title"), robots: { index: false } };
}

export default async function TripsPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  const t = await getTranslations("trips");
  return (
    <div className="grid max-w-3xl gap-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <Suspense>
        <RequireAuth>
          <TripList />
        </RequireAuth>
      </Suspense>
    </div>
  );
}
