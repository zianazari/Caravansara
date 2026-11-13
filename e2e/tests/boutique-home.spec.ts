import { expect, test } from "@playwright/test";
import path from "node:path";
import { WEB } from "./helpers";

const origin = process.env.BOUTIQUE_WEB ?? WEB;
test.use({ extraHTTPHeaders: {} });

for (const locale of ["fa", "en"] as const) {
  test(`boutique home: ${locale} stays responsive and accessible`, async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.goto(`${origin}/${locale}`);
    await expect(page.locator("#hero-title")).toBeVisible();
    const footer = page.getByRole("contentinfo");
    await expect(footer).not.toContainText(/simulated|شبیه‌سازی/);
    await expect(
      footer.getByRole("link", {
        name: locale === "fa" ? "میزبان شوید" : "Become a host",
      }),
    ).toHaveAttribute("href", `/${locale}/host/new`);

    await expect(page.locator("#hero-title")).toContainText(
      locale === "fa" ? "مقصدی برای کشف" : "Something to discover",
    );
    await expect(
      page.locator("section[aria-labelledby='hero-title'] img"),
    ).toHaveJSProperty("complete", true);
    expect(
      await page
        .locator("section[aria-labelledby='hero-title'] img")
        .evaluate((el) => (el as HTMLImageElement).naturalWidth),
    ).toBeGreaterThan(0);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
    }
    await page.addScriptTag({
      path: path.join(__dirname, "../node_modules/axe-core/axe.min.js"),
    });
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      const violations = await page.evaluate(async () => {
        // @ts-expect-error axe is injected in the browser
        const result = await window.axe.run(document, {
          runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
        });
        return result.violations.map(
          (v: { id: string; nodes: { target: string[] }[] }) => ({
            id: v.id,
            targets: v.nodes.map((n) => n.target),
          }),
        );
      });
      expect(violations, `${locale} at ${width}px`).toEqual([]);
    }
    if (process.env.BOUTIQUE_SHOTS) {
      await footer.scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `/private/tmp/caravansara-${locale}-footer.png`,
      });
      await page.evaluate(() =>
        window.scrollTo({ top: 0, behavior: "instant" }),
      );
      await expect(page.locator("[data-home-search]")).toHaveAttribute(
        "data-compact",
        "false",
      );

      await page.screenshot({
        path: `/private/tmp/caravansara-${locale}-desktop.png`,
        fullPage: false,
      });
      await page.setViewportSize({ width: 390, height: 900 });
      await page.screenshot({
        path: `/private/tmp/caravansara-${locale}-mobile.png`,
        fullPage: false,
      });
    }
    await page.setViewportSize({ width: 390, height: 900 });
    await page
      .getByRole("button", {
        name: locale === "fa" ? /کجا می‌روید/ : /Where to/,
      })
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await page.locator('a[href*="category=pets#stays"]').click();
    await expect(page).toHaveURL(/category=pets#stays/);
    await expect(page.locator('nav a[aria-current="true"]')).toContainText(
      locale === "fa" ? "حیوان خانگی" : "Pets",
    );
  });
}

for (const locale of ["fa", "en"] as const) {
  test(`home search follows scroll without losing selections (${locale})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${origin}/${locale}`);
    const search = page.locator("[data-home-search]");
    await expect(search).toHaveAttribute("data-compact", "false");
    const city = search.getByRole("combobox");
    await city.fill("Tehran");
    await search
      .getByRole("option", { name: /تهران|Tehran/ })
      .first()
      .click();
    const selected = await city.inputValue();
    await page.evaluate(() =>
      window.scrollTo({ top: 1200, behavior: "instant" }),
    );
    await expect(search).toHaveAttribute("data-compact", "true");
    await expect(city).toBeInViewport();
    await expect(city).toHaveValue(selected);
    const box = await search.boundingBox();
    expect(box!.height).toBeLessThan(90);
    expect(box!.y).toBeGreaterThanOrEqual(
      await page
        .locator("header")
        .evaluate((el) => el.getBoundingClientRect().bottom),
    );
    await search
      .getByRole("button", { name: locale === "fa" ? /تاریخ/ : /Dates/ })
      .click();
    await expect(page.getByRole("grid")).toBeVisible();
    await page.keyboard.press("Escape");
    if (process.env.BOUTIQUE_SHOTS)
      await page.screenshot({
        path: `/private/tmp/caravansara-${locale}-compact-search.png`,
      });
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await expect(search).toHaveAttribute("data-compact", "false");
    await expect(city).toHaveValue(selected);
    await page.setViewportSize({ width: 390, height: 900 });
    await page.evaluate(() =>
      window.scrollTo({ top: 1200, behavior: "instant" }),
    );
    await expect(search).toHaveAttribute("data-compact", "true");
    await search
      .getByRole("button", {
        name: locale === "fa" ? /کجا می‌روید/ : /Where to/,
      })
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });
}
