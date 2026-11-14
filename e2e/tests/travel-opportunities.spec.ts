import { expect, test } from "@playwright/test";
import path from "node:path";
import { API, WEB, createListing, register } from "./helpers";

test.use({ extraHTTPHeaders: {} });

test("budget discovery works in the unified design and languages and hands real quotes into booking", async ({
  page,
  request,
}) => {
  test.setTimeout(180_000);
  const host = await register(request, "opportunityhost");
  const cities = await (
    await request.get(`${API}/cities`, { params: { q: "Tehran" } })
  ).json();
  const tehran = cities.find(
    (city: { name: string }) => city.name === "Tehran",
  );
  expect(tehran).toBeTruthy();
  await createListing(request, host, {
    title: "فرصت سفر در تهران",
    city_id: tehran.id,
    latitude: 35.72,
    longitude: 51.4,
    max_guests: 50,
    currency: "IRR",
    price_per_night: "20000000",
    cleaning_fee: "3000000",
  });

  for (const origin of [WEB]) {
    for (const locale of ["fa", "en"]) {
      const fa = locale === "fa";
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto(`${origin}/${locale}`);
      await page
        .getByRole("link", {
          name: /Let your budget inspire|مقصد بعدی‌ات را با بودجه‌ات/,
        })
        .click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/opportunities$`));
      await page
        .getByRole("button", { name: fa ? /^مهمان‌ها:/ : /^Guests:/ })
        .click();
      await page
        .getByRole("textbox", { name: fa ? "بزرگسال" : "Adults", exact: true })
        .fill("50");
      await page.keyboard.press("Escape");
      const response = page.waitForResponse(
        (r) =>
          r.url().includes("/search/opportunities") &&
          r.request().method() === "GET",
      );
      await page
        .getByRole("button", {
          name: fa ? "فرصت سفرم را پیدا کن" : "Find my travel opportunities",
        })
        .click();
      const api = await response;
      expect(api.status()).toBe(200);
      const body = await api.json();
      expect(body.items.length).toBeGreaterThan(0);
      expect(body.items.length).toBeLessThanOrEqual(3);
      expect(
        new Set(
          body.items.map((i: { listing: { id: number } }) => i.listing.id),
        ).size,
      ).toBe(body.items.length);
      await expect(page.locator("[data-opportunity]")).toHaveCount(
        body.items.length,
      );
      for (const item of body.items) {
        expect(Number(item.total_price)).toBeLessThanOrEqual(100000000);
        const quote = await request.get(
          `${API}/listings/${item.listing.id}/pricing/quote`,
          { params: { check_in: item.check_in, check_out: item.check_out } },
        );
        expect((await quote.json()).total_price).toBe(item.total_price);
      }
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(width);
      }
      await page.addScriptTag({
        path: path.join(__dirname, "../node_modules/axe-core/axe.min.js"),
      });
      const violations = await page.evaluate(async () => {
        // @ts-expect-error axe is injected into the real browser
        const result = await window.axe.run(document, {
          runOnly: {
            type: "tag",
            values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"],
          },
        });
        return result.violations.map(
          (v: { id: string; nodes: { target: string[] }[] }) => ({
            id: v.id,
            nodes: v.nodes.map((n) => n.target),
          }),
        );
      });
      expect(violations).toEqual([]);
      const chosen = body.items[0];
      const booking = page
        .locator("[data-opportunity]")
        .first()
        .getByRole("link", { name: fa ? /^دیدن و رزرو / : /^View and book / });
      const href = await booking.getAttribute("href");
      expect(href).toContain(
        `check_in=${chosen.check_in}&check_out=${chosen.check_out}&adults=50&children=0&infants=0&pets=0`,
      );
      await booking.click();
      await expect(page).toHaveURL(
        new RegExp(`/listings/${chosen.listing.id}\\?`),
      );
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        chosen.listing.title,
      );
    }
  }
});
