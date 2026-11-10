import type { Metadata } from "next";
import type { ReactNode } from "react";

/** The admin panel (feature 009): never indexed; served only on the admin host (proxy.ts). */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
