import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations("common");
  return (
    <section className="mx-auto grid max-w-md justify-items-center gap-4 py-16 text-center">
      {/* 007: an empty caravansara doorway. */}
      <span aria-hidden className="arch block h-28 w-24 bg-muted" />
      <h1 className="text-2xl font-bold">{t("notFoundTitle")}</h1>
      <p className="text-muted-foreground">{t("notFoundText")}</p>
      <Button asChild className="rounded-full">
        <Link href="/">{t("goHome")}</Link>
      </Button>
    </section>
  );
}
