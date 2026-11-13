import type { Metadata } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import localFont from "next/font/local";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { headers } from "next/headers";
import { isAdminRequest } from "@/lib/adminHost";
import type { ReactNode } from "react";
import { BottomNav } from "@/components/layout/BottomNav";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { Providers } from "@/components/providers";
import { direction, routing } from "@/i18n/routing";
import "../globals.css";

/** Served from the site, not a font CDN: no outside service, and no layout shift while it loads (FR-001). */
const vazirmatn = localFont({
  src: "../fonts/Vazirmatn-Variable.woff2",
  variable: "--font-vazirmatn",
  weight: "100 900",
  display: "swap",
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home" });
  return { title: { default: t("title"), template: `%s · ${t("siteName")}` }, description: t("description") };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  // Every page renders per request: the content security policy needs a fresh nonce each time (research R21).
  await connection();
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const dir = direction[locale];
  const onAdminHost = isAdminRequest(await headers());
  const cinematic = onAdminHost || process.env.CARAVANSARA_DESIGN === "cinematic";

  return (
    <html
      lang={locale}
      dir={dir}
      className={vazirmatn.variable}
      data-design={cinematic ? "cinematic" : undefined}
    >
      {/* On a phone a fixed bar sits at the bottom (BottomNav, or a listing's booking bar), so the page keeps
          room for it and nothing hides under it (specs/007-caravansara-theme, FR-008). */}
      <body className="flex min-h-dvh flex-col pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
        <NextIntlClientProvider>
          <Providers dir={dir}>
            <Header />
            {/* A page that marks itself data-wide (the home page, feature 017) gets almost the whole screen. */}
            <main
              id="main"
              className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 md:px-6 has-[>[data-wide]]:max-w-[1920px] has-[>[data-wide]]:lg:px-10"
            >
              {children}
            </main>
            <Footer admin={onAdminHost} />
            <BottomNav />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
