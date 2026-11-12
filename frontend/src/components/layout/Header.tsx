"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { HeartIcon, LogOutIcon, LuggageIcon, MenuIcon, UserRoundIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Suspense } from "react";
import { api } from "@/api/client";
import { UserAvatar } from "@/components/account/UserAvatar";
import { Logo } from "@/components/brand/Logo";
import { AdminHeader } from "@/components/admin/AdminHeader";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthState, useMe } from "@/hooks/useAuth";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { logout } from "@/lib/session";
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
  const queryClient = useQueryClient();
  const router = useRouter();

  // Log-out at the bottom of the account menu (feature 024), as on the account page: the session ends, the
  // user's cached data goes, and the home page opens.
  async function signOut() {
    await logout();
    queryClient.removeQueries({ queryKey: ["me"] });
    router.replace("/");
  }
  return (
    <header className="no-print sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
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
        {pathname === "/" ? (
          <a
            href="#stays"
            className="me-5 hidden rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary lg:inline-flex"
          >
            {t("home.explore")}
          </a>
        ) : null}
        <span className="hidden md:block">
          <Suspense>
            <LocaleSwitch />
          </Suspense>
        </span>
        {host ? (
          <Link
            href={host.href}
            className="hidden h-9 items-center rounded-full border bg-card px-4 text-sm font-semibold transition-[transform,background-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:bg-muted hover:shadow-sm md:inline-flex"
          >
            {t(`nav.${host.label}`)}
          </Link>
        ) : null}
        {state === "signedOut" ? (
          <Link
            href={{ pathname: "/login", query: { returnTo: pathname } }}
            // Feature 046 (owner's request): a larger, wider log-in button, the main action for a visitor.
            className="inline-flex h-11 min-w-28 items-center justify-center rounded-full bg-primary px-8 text-base font-semibold text-primary-foreground shadow-sm transition-[transform,background-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-md"
          >
            {t("nav.login")}
          </Link>
        ) : state === "signedIn" ? (
          // shadcn/ui DropdownMenu (feature 026): a real menu, so arrow keys move between items, Esc closes it,
          // and choosing an item closes it by itself.
          <DropdownMenu>
            <DropdownMenuTrigger
              className="flex items-center gap-2 rounded-full border bg-card py-1 ps-3 pe-1 shadow-sm hover:shadow-md"
              aria-label={t("nav.account")}
            >
              <MenuIcon className="size-4" aria-hidden />
              {me.data ? (
                <UserAvatar user={me.data} size="sm" />
              ) : (
                <span className="inline-block size-8 rounded-full bg-muted" />
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {host ? (
                <DropdownMenuItem asChild className="md:hidden">
                  <Link href={host.href}>{t(`nav.${host.label}`)}</Link>
                </DropdownMenuItem>
              ) : null}
              {/* Feature 046: each item has the icon the phone's bottom bar uses for the same page. */}
              <DropdownMenuItem asChild>
                <Link href="/wishlists">
                  <HeartIcon aria-hidden />
                  {t("nav.wishlists")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/trips">
                  <LuggageIcon aria-hidden />
                  {t("nav.trips")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/account">
                  <UserRoundIcon aria-hidden />
                  {t("nav.account")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="md:hidden" />
              <Suspense>
                <DropdownMenuItem asChild className="md:hidden">
                  <LocaleSwitch className="px-3 py-2.5" />
                </DropdownMenuItem>
              </Suspense>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void signOut()}>
                <LogOutIcon className="rtl:-scale-x-100" aria-hidden />
                {t("nav.logout")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <span className="inline-block h-10 w-20 rounded-full bg-muted" aria-hidden />
        )}
      </nav>
    </header>
  );
}
