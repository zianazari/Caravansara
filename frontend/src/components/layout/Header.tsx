"use client";

import { useQuery } from "@tanstack/react-query";
import { MenuIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Suspense } from "react";
import { api } from "@/api/client";
import { UserAvatar } from "@/components/account/UserAvatar";
import { Logo } from "@/components/brand/Logo";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuthState, useMe } from "@/hooks/useAuth";
import { Link, usePathname } from "@/i18n/navigation";
import { LocaleSwitch } from "./LocaleSwitch";

/**
 * Caravansara theme (specs/007-caravansara-theme, FR-004): the arch logo, the other language, the host link
 * (specs/008-host-pages, R11) and a round account menu (menu icon and avatar) as on the booking sites people
 * know. On a phone the bottom bar carries search, trips and profile, so the header stays small and the host
 * link moves into the account menu.
 */
/**
 * "Become a host" or "My listings" (FR-001, research R11): a signed-in user with a listing goes to their
 * listings; anyone else to the new-listing form, through the login page when not signed in. One small request
 * (GET /me/listings?limit=1), kept five minutes, and only for a signed-in user.
 */
export function useHostLink(): { href: string; label: "becomeHost" | "myListings" } | null {
  const state = useAuthState();
  const listings = useQuery({
    queryKey: ["me", "listings", "any"],
    enabled: state === "signedIn",
    staleTime: 5 * 60 * 1000,
    queryFn: async () =>
      (await api.GET("/api/v1/me/listings", { params: { query: { limit: 1 } } })).data ?? null,
  });
  if (state === "signedOut") return { href: "/login?returnTo=/host/new", label: "becomeHost" };
  if (state !== "signedIn" || listings.isPending) return null;
  return (listings.data?.total ?? 0) > 0
    ? { href: "/host", label: "myListings" }
    : { href: "/host/new", label: "becomeHost" };
}

/** Pages that use the whole width (data-wide): the lists of places (feature 017). */
const WIDE = new Set(["/", "/search", "/wishlists", "/host"]);

/** The admin panel's pages (feature 009, only on the admin host) have their own header and no host link. */
export function Header() {
  const pathname = usePathname();
  return pathname.startsWith("/admin") ? <AdminHeader /> : <SiteHeader />;
}

function SiteHeader() {
  const t = useTranslations();
  const state = useAuthState();
  const me = useMe();
  const pathname = usePathname();
  const host = useHostLink();
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
        // The list pages are wider since feature 017; the header lines up with them.
        className={`mx-auto flex items-center gap-3 px-4 py-3 md:px-6 ${WIDE.has(pathname) || pathname.startsWith("/listings/") ? "max-w-[1920px] lg:px-10" : "max-w-7xl"}`}
      >
        <Link href="/" className="me-auto rounded-lg" aria-label={t("common.siteName")}>
          <Logo />
        </Link>
        <span className="hidden md:block">
          <Suspense>
            <LocaleSwitch />
          </Suspense>
        </span>
        {host ? (
          <Link
            href={host.href}
            className="hidden rounded-full px-3 py-2 text-sm font-semibold hover:bg-muted md:block"
          >
            {t(`nav.${host.label}`)}
          </Link>
        ) : null}
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
              {host ? (
                <Link href={host.href} className={`${item} md:hidden`}>
                  {t(`nav.${host.label}`)}
                </Link>
              ) : null}
              <Link href="/wishlists" className={item}>
                {t("nav.wishlists")}
              </Link>
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
