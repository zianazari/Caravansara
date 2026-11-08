import { useTranslations } from "next-intl";

export function Footer() {
  const t = useTranslations("common");
  return (
    <footer className="border-t py-6 text-center text-sm text-muted-foreground">
      <p>
        {t("siteName")} · {t("footerNote")}
      </p>
    </footer>
  );
}
