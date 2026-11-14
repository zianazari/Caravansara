import { setRequestLocale } from "next-intl/server";
import { CinematicHome } from "@/components/home/CinematicHome";
import { todayInZone } from "@/lib/cityTime";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <CinematicHome today={todayInZone("UTC")} />;
}
