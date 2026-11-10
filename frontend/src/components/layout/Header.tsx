"use client";

import { MenuIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Suspense } from "react";
import { UserAvatar } from "@/components/account/UserAvatar";
import { Logo } from "@/components/brand/Logo";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuthState, useMe } from "@/hooks/useAuth";
import { Link, usePathname } from "@/i18n/navigation";
import { LocaleSwitch } from "./LocaleSwitch";

/**
 * Caravansara theme (specs/007-caravansara-theme, FR-004): the arch logo, the other language, and a round
 * account menu (menu icon and avatar) as on the booking sites people know. No "become a host" link until the
 * host pages exist. On a phone the bottom bar carries search, trips and profile, so the header stays small.
 */
export function Header() {
  const t = useTranslations();
  const state = useAuthState();
  const me = useMe();
  const pathname = usePathname();
  const item = "block rounded-lg px-3 py-2 hover:bg-muted";
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:start-2 focus:top-2 focus:rounded focus:bg-card focus:p-2"
      >
        {t("nav.skipToContent")}
      </a>
      <nav
        aria-label={t("nav.mainMenu")}
        className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 md:px-6"
      >
        <Link href="/" className="me-auto rounded-lg" aria-label={t("common.siteName")}>
          <Logo />
        </Link>
        <span className="hidden md:block">
          <Suspense>
            <LocaleSwitch />
          </Suspense>
        </span>
        {state === "signedOut" ? (
          <Link
            href={{ pathname: "/login", query: { returnTo: pathname } }}
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            {t("nav.login")}
          </Link>
        ) : state === "signedIn" ? (
          <Popover>
            <PopoverTrigger
              className="flex items-center gap-2 rounded-full border bg-card py-1 ps-3 pe-1 shadow-sm hover:shadow-md"
              aria-label={t("nav.account")}
            >
              <MenuIcon className="size-4" aria-hidden />
              {me.data ? (
                <UserAvatar user={me.data} size="sm" />
              ) : (
                <span className="inline-block size-8 rounded-full bg-muted" />
              )}
            </PopoverTrigger>
            <PopoverContent align="end" className="grid w-56 gap-1 p-2">
              <Link href="/trips" className={item}>
                {t("nav.trips")}
              </Link>
              <Link href="/account" className={item}>
                {t("nav.account")}
              </Link>
              <span className="border-t pt-1 md:hidden">
                <Suspense>
                  <LocaleSwitch />
                </Suspense>
              </span>
            </PopoverContent>
          </Popover>
        ) : (
          <span className="inline-block h-10 w-20 rounded-full bg-muted" aria-hidden />
        )}
      </nav>
    </header>
  );
}
