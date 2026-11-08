import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderOptions } from "@testing-library/react";
import axe from "axe-core";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";
import en from "../../messages/en.json";
import fa from "../../messages/fa.json";

/** Renders inside the same providers as the site, in one language and direction. */
export function renderIn(locale: "fa" | "en", ui: ReactElement, options?: RenderOptions) {
  document.documentElement.lang = locale;
  document.documentElement.dir = locale === "fa" ? "rtl" : "ltr";
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale={locale} messages={locale === "fa" ? fa : en} timeZone="UTC">
        {ui}
      </NextIntlClientProvider>
    </QueryClientProvider>,
    options,
  );
}

/**
 * WCAG 2.x A and AA checks with axe (SC-004). Colour contrast needs a real browser's layout, which jsdom does
 * not have, so it is left to the browser check (T069); every other rule must pass.
 */
export async function expectAccessible(container: Element) {
  const result = await axe.run(container, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] },
    rules: { "color-contrast": { enabled: false } },
  });
  const problems = result.violations.map(
    (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
  );
  expect(problems).toEqual([]);
}
