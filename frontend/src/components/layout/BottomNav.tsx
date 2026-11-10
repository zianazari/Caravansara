"use client";

import { LuggageIcon, SearchIcon, UserRoundIcon, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAuthState } from "@/hooks/useAuth";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

/** Pages that have their own fixed booking bar at the bottom instead (research R7). */
const OWN_BAR = ["/listings/", "/book/"];

/**
 * The phone's bottom bar (specs/007-caravansara-theme, FR-008): search, trips and profile (or log in), each an
 * icon in the caravansara arch, the current one copper. Three items, not four: wishlists come with their own
 * feature (answer Q3). The listing and booking pages show their booking bar here instead, because two fixed
 * bars would take half of a small screen (research R7). The layout keeps room for it, so nothing hides under it.
 */
export function BottomNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const state = useAuthState();
  if (OWN_BAR.some((prefix) => pathname.startsWith(prefix))) return null;

  const items: { href: string; label: string; Icon: LucideIcon; on: boolean }[] = [
    {
      href: "/",
      label: t("search"),
      Icon: SearchIcon,
      on: pathname === "/" || pathname.startsWith("/search"),
    },
    { href: "/trips", label: t("trips"), Icon: LuggageIcon, on: pathname.startsWith("/trips") },
    state === "signedIn"
      ? { href: "/account", label: t("profile"), Icon: UserRoundIcon, on: pathname.startsWith("/account") }
      : {
          href: "/login",
          label: t("login"),
          Icon: UserRoundIcon,
          on: pathname.startsWith("/login") || pathname.startsWith("/register"),
        },
  ];

  return (
    <nav
      aria-label={t("bottomNav")}
      className="no-print fixed inset-x-0 bottom-0 z-40 border-t bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="flex justify-around">
        {items.map(({ href, label, Icon, on }) => (
          <li key={href}>
            <Link
              href={href}
              aria-current={on ? "page" : undefined}
              className={cn(
                "flex min-w-16 flex-col items-center gap-1 px-2 pt-2 pb-2.5 text-xs",
                on ? "font-bold text-primary" : "text-muted-foreground",
              )}
            >
              <span
                aria-hidden
                className={cn("arch grid h-7 w-6 place-items-center", on ? "bg-copper" : "bg-sand-strong")}
              >
                <Icon className="mt-1.5 size-3.5 text-on-dark" />
              </span>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
