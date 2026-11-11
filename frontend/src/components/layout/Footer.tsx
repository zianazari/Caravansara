import { useTranslations } from "next-intl";
import { LogoMark } from "@/components/brand/Logo";

/**
 * Dark brown with quiet sand text and the site's mark and name in gold (specs/007-caravansara-theme,
 * data-model: footer; the mark since feature 036). On a phone the bottom bar sits under it, so the layout leaves room for that bar.
 */
export function Footer() {
  const t = useTranslations("common");
  return (
    <footer className="no-print bg-foreground py-6 text-center text-sm text-on-dark-muted">
      <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
        <span className="flex items-center gap-1.5 font-bold text-gold">
          <LogoMark tone="dark" className="h-6 w-5" />
          {t("siteName")}
        </span>
        <span aria-hidden>·</span>
        {t("footerNote")}
      </p>
    </footer>
  );
}
