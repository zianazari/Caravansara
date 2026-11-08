"use client";

import { useTranslations } from "next-intl";
import { Suspense } from "react";
import { UserAvatar } from "@/components/account/UserAvatar";
import { Button } from "@/components/ui/button";
import { useAuthState, useMe } from "@/hooks/useAuth";
import { Link, usePathname } from "@/i18n/navigation";
import { LocaleSwitch } from "./LocaleSwitch";

export function Header() {
  const t = useTranslations();
  const state = useAuthState();
  const me = useMe();
  const pathname = usePathname();
  return (
    <header className="border-b bg-card">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:start-2 focus:top-2 focus:rounded focus:bg-card focus:p-2"
      >
        {t("nav.skipToContent")}
      </a>
      <nav aria-label={t("nav.mainMenu")} className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3">
        <Link href="/" className="me-auto text-xl font-bold text-primary">
          {t("common.siteName")}
        </Link>
        <Suspense>
          <LocaleSwitch />
        </Suspense>
        {state === "signedIn" ? (
          <>
            <Button asChild variant="ghost" size="sm">
              <Link href="/trips">{t("nav.trips")}</Link>
            </Button>
            <Link href="/account" aria-label={t("nav.account")} className="rounded-full">
              {me.data ? (
                <UserAvatar user={me.data} size="sm" />
              ) : (
                <span className="inline-block size-8 rounded-full bg-muted" />
              )}
            </Link>
          </>
        ) : state === "signedOut" ? (
          <Button asChild size="sm">
            <Link href={{ pathname: "/login", query: { returnTo: pathname } }}>{t("nav.login")}</Link>
          </Button>
        ) : (
          <span className="inline-block h-9 w-16 rounded-lg bg-muted" aria-hidden />
        )}
      </nav>
    </header>
  );
}
