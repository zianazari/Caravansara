import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations("common");
  return (
    <section className="mx-auto grid max-w-md gap-4 py-16 text-center">
      <h1 className="text-2xl font-bold">{t("notFoundTitle")}</h1>
      <p className="text-muted-foreground">{t("notFoundText")}</p>
      <Button asChild className="justify-self-center">
        <Link href="/">{t("goHome")}</Link>
      </Button>
    </section>
  );
}
