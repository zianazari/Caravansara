"use client";

import { useTranslations } from "next-intl";
import { Suspense } from "react";
import { adminLogout } from "@/api/adminClient";
import { Logo } from "@/components/brand/Logo";
import { LocaleSwitch } from "@/components/layout/LocaleSwitch";
import { Button } from "@/components/ui/button";
import { Link, usePathname, useRouter } from "@/i18n/navigation";

/** The panel's own header (feature 009): the logo, "Admin panel", the other language and log-out. */
export function AdminHeader() {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const onLogin = pathname.startsWith("/admin/login");
  return (
    <header className="sticky top-0 z-40 border-b bg-night text-on-dark">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:start-2 focus:top-2 focus:rounded focus:bg-card focus:p-2 focus:text-foreground"
      >
        {t("nav.skipToContent")}
      </a>
      <nav
        aria-label={t("admin.title")}
        className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 md:px-6"
      >
        <Link href="/admin" className="me-auto flex min-w-0 items-center gap-3 rounded-lg">
          <Logo />
          {/* Words only from 640 px: at 320 px the logo, the language and log-out fill the bar. The nav keeps the name. */}
          <span className="hidden text-sm font-semibold text-on-dark-muted sm:inline">
            {t("admin.title")}
          </span>
        </Link>
        <Suspense>
          <LocaleSwitch />
        </Suspense>
        {onLogin ? null : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full text-foreground"
            onClick={async () => {
              await adminLogout();
              router.replace("/admin/login");
            }}
          >
            {t("admin.logout")}
          </Button>
        )}
      </nav>
    </header>
  );
}
