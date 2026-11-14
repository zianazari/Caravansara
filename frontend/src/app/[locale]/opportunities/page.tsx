import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { TravelOpportunities } from "@/components/opportunities/TravelOpportunities";
import { todayInZone } from "@/lib/cityTime";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "opportunities" });
  return { title: t("name"), description: t("description") };
}

export default async function OpportunitiesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <TravelOpportunities today={todayInZone("Asia/Tehran")} />;
}
