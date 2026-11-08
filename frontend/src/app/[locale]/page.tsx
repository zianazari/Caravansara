import { getTranslations, setRequestLocale } from "next-intl/server";
import { SearchForm } from "@/components/search/SearchForm";
import { Link } from "@/i18n/navigation";
import { todayInZone } from "@/lib/cityTime";

/** Cities of the demo data, as quick starting points. */
const SUGGESTED = [
  { name: "Tehran", query: "Tehran" },
  { name: "Isfahan", query: "Isfahan" },
  { name: "Shiraz", query: "Shiraz" },
  { name: "London", query: "London" },
  { name: "Amsterdam", query: "Amsterdam" },
  { name: "Stockholm", query: "Stockholm" },
];

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  return (
    <section className="grid gap-8">
      <div className="grid gap-2">
        <h1 className="text-3xl font-bold">{t("home.heading")}</h1>
        <p className="text-muted-foreground">{t("home.lead")}</p>
      </div>
      <SearchForm today={todayInZone("UTC")} />
      <nav aria-labelledby="suggested" className="grid gap-3">
        <h2 id="suggested" className="text-lg font-semibold">
          {t("home.popular")}
        </h2>
        <ul className="flex flex-wrap gap-2">
          {SUGGESTED.map((city) => (
            <li key={city.name}>
              <Link
                href={`/search/city/${encodeURIComponent(city.query)}`}
                className="inline-block rounded-full border bg-card px-4 py-2 hover:bg-muted"
              >
                {t(`cities.${city.name}`)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </section>
  );
}
