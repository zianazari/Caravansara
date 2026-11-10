import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { WishlistView } from "@/components/wishlist/WishlistView";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: "wishlist" });
  return { title: t("title"), robots: { index: false } };
}

/** The member's saved listings (feature 012). */
export default async function WishlistsPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  const t = await getTranslations("wishlist");
  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <Suspense>
        <RequireAuth>
          <WishlistView />
        </RequireAuth>
      </Suspense>
    </div>
  );
}
