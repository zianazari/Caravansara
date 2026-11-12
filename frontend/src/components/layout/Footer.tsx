import { ArrowUpLeftIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { LogoMark } from "@/components/brand/Logo";
import { Link } from "@/i18n/navigation";

/** A quiet travel sign-off with real guest and host destinations, in both reading directions. */
export function Footer() {
  const t = useTranslations();
  return (
    <footer className="no-print border-t border-copper/30 bg-foreground text-on-dark-muted">
      <div className="mx-auto max-w-[1600px] px-6 pt-12 pb-6 md:px-10 md:pt-16">
        <div className="grid gap-10 pb-10 md:grid-cols-[1.5fr_1fr_1fr] md:gap-16 md:pb-14">
          <div>
            <Link href="/" className="inline-flex items-center gap-2 rounded-lg text-xl font-bold text-gold">
              <LogoMark tone="dark" className="h-9 w-8" />
              {t("common.siteName")}
            </Link>
            <p className="mt-5 text-2xl leading-relaxed font-semibold text-on-dark md:text-3xl">
              {t("footer.tagline")}
            </p>
            <p className="mt-3 max-w-md text-base leading-8 md:text-lg">{t("footer.description")}</p>
          </div>
          <nav aria-label={t("footer.explore")}>
            <h2 className="mb-4 text-lg font-semibold text-on-dark">{t("footer.explore")}</h2>
            <ul className="grid gap-1 text-base">
              {(
                [
                  ["/", "footer.findStay"],
                  ["/wishlists", "nav.wishlists"],
                  ["/trips", "nav.trips"],
                ] as const
              ).map(([href, label]) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="inline-flex min-h-11 items-center rounded-md transition-colors hover:text-gold"
                  >
                    {t(label)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div>
            <h2 className="mb-4 text-lg font-semibold text-on-dark">{t("footer.hostTitle")}</h2>
            <p className="max-w-xs text-base leading-8">{t("footer.hostDescription")}</p>
            <Link
              href="/host/new"
              className="mt-5 inline-flex min-h-11 items-center gap-5 rounded-full border border-on-dark-muted/50 px-5 py-2 text-base font-semibold text-on-dark transition-colors hover:border-gold hover:text-gold"
            >
              {t("nav.becomeHost")}
              <ArrowUpLeftIcon className="size-4 ltr:rotate-90" aria-hidden />
            </Link>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-on-dark-muted/20 pt-5 text-sm">
          <p>{t("footer.copyright")}</p>
          <p className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-copper" aria-hidden />
            {t("footer.signoff")}
          </p>
        </div>
      </div>
    </footer>
  );
}
