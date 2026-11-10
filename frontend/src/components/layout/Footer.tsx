import { useTranslations } from "next-intl";

/**
 * Dark brown with quiet sand text and the site's name in gold (specs/007-caravansara-theme, data-model:
 * footer). On a phone the bottom bar sits under it, so the layout leaves room for that bar.
 */
export function Footer() {
  const t = useTranslations("common");
  return (
    <footer className="no-print bg-foreground py-6 text-center text-sm text-on-dark-muted">
      <p>
        <span className="font-bold text-gold">{t("siteName")}</span> · {t("footerNote")}
      </p>
    </footer>
  );
}
