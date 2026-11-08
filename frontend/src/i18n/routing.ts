import { defineRouting } from "next-intl/routing";

/**
 * Persian is the default and the language of every address without a prefix (spec FR-001). The browser
 * language is not used to guess, because the spec names Persian as the default (plan, Assumptions).
 */
export const routing = defineRouting({
  locales: ["fa", "en"],
  defaultLocale: "fa",
  localePrefix: "always",
  localeDetection: false,
});

export type Locale = (typeof routing.locales)[number];

/** Text direction of each language: Persian right-to-left, English left-to-right (FR-001). */
export const direction: Record<Locale, "rtl" | "ltr"> = { fa: "rtl", en: "ltr" };
