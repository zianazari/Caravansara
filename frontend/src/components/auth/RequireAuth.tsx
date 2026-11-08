"use client";

import { useEffect, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthState } from "@/hooks/useAuth";
import { usePathname, useRouter } from "@/i18n/navigation";

/**
 * Pages that need an account (booking, payment, trips, review, profile). A visitor who is not signed in goes
 * to the login page and comes back to the same address, with the same choices, afterwards (FR-014, US2/AC7).
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const state = useAuthState();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams().toString();

  useEffect(() => {
    if (state !== "signedOut") return;
    const here = search ? `${pathname}?${search}` : pathname;
    router.replace({ pathname: "/login", query: { returnTo: here } });
  }, [state, pathname, search, router]);

  if (state !== "signedIn") {
    return (
      <div className="grid gap-3" aria-busy="true">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  return <>{children}</>;
}
