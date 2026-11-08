import { createTranslator } from "next-intl";
import { vi } from "vitest";
import en from "../../messages/en.json";
import fa from "../../messages/fa.json";

/** next-intl/server for tests of server components: translations from the real message files. */
export const intl = { locale: "fa" as "fa" | "en" };

export function serverIntlMock() {
  const translator = (namespace?: string) => {
    const t = createTranslator({
      locale: intl.locale,
      messages: intl.locale === "fa" ? fa : en,
      namespace: namespace as never,
    });
    return t;
  };
  return {
    setRequestLocale: vi.fn((locale: "fa" | "en") => {
      intl.locale = locale;
    }),
    getLocale: async () => intl.locale,
    getTranslations: async (arg?: string | { locale: "fa" | "en"; namespace?: string }) => {
      if (typeof arg === "object") {
        intl.locale = arg.locale;
        return translator(arg.namespace);
      }
      return translator(arg);
    },
  };
}
