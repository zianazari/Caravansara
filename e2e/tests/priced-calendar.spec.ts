import { expect, test, type Locator } from "@playwright/test";
import path from "node:path";
import { API, auth, createListing, day, register, reserve } from "./helpers";

test.use({ extraHTTPHeaders: {} });
test("guests compare nightly prices, confirm exact totals and leave on a booked date in both designs", async ({ page, request }) => {
  test.setTimeout(180_000);
  const host = await register(request, "pricedcalendarhost");
  const guest = await register(request, "pricedcalendarguest");
  const listing = await createListing(request, host, { title: "تقویم قیمت اقامتگاه نمونه", city_id: 7, latitude: 35.72, longitude: 51.4, currency: "IRR", price_per_night: "20000000", cleaning_fee: "3000000" });
  let startOffset = 2;
  while (new Date(`${day(startOffset)}T00:00:00Z`).getUTCDay() !== 4) startOffset++;
  const start = day(startOffset);
  const custom = day(startOffset + 1);
  const end = day(startOffset + 3);
  // Iran's calendar weekends stay visible even when the host has not enabled a rate adjustment.
  for (const origin of ["http://localhost:3001", "http://localhost:3011"]) {
    for (const locale of ["fa", "en"]) {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto(`${origin}/${locale}/listings/${listing.id}`);
      const inline = page.locator(`section[aria-labelledby="calendar-title"] [data-date="${start}"]`);
      await expect(inline).toHaveAttribute("data-price-source", "base");
      await expect(inline.locator("[data-day-price]")).toHaveClass(/text-primary/);
      const plain = page.locator(`section[aria-labelledby="calendar-title"] [data-date="${day(startOffset - 1)}"] [data-day-price]`);
      const regularColor = await plain.evaluate(el => getComputedStyle(el).color);
      await expect.poll(() => inline.locator("[data-day-price]").evaluate(el => getComputedStyle(el).color)).not.toBe(regularColor);
      await page.locator(`aside[aria-label="${locale === "fa" ? "قیمت" : "Price"}"]`).getByRole("button", { name: locale === "fa" ? /^تاریخ سفر/ : /^Dates/ }).click();
      const dialog = page.getByRole("dialog");
      const thursday = await goToDate(dialog, start, locale);
      await expect(thursday).toHaveAttribute("data-price-source", "base");
      await expect(thursday.locator("[data-day-price]")).toHaveText(locale === "fa" ? "۲" : "2");
      await expect(thursday.locator("[data-day-price]")).toHaveClass(/text-primary/);
      const friday = await goToDate(dialog, custom, locale);
      await expect(friday.locator("[data-day-price]")).toHaveClass(/text-primary/);
      await page.keyboard.press("Escape");
    }
  }
  expect((await request.put(`${API}/listings/${listing.id}/pricing`, { headers: auth(host), data: {
    weekend_enabled: true, weekend_days: [3, 4], weekend_percent: 30,
    ranges: [{ name: "تخفیف نمونه", start: custom, end: custom, percent: -20 }],
  } })).status()).toBe(200);
  const booking = await (await reserve(request, guest, listing.id, end, day(startOffset + 5))).json();
  expect((await request.post(`${API}/bookings/${booking.id}/pay`, { headers: auth(guest) })).status()).toBe(200);
  const quoteResponse = await request.get(`${API}/listings/${listing.id}/pricing/quote`, { params: { check_in: start, check_out: end } });
  expect(quoteResponse.status()).toBe(200);
  expect((await quoteResponse.json()).total_price).toBe("65000000.00");

  async function goToDate(dialog: Locator, iso: string, locale: string) {
    for (let i = 0; i < 14 && !(await dialog.locator(`[data-date="${iso}"]`).count()); i++) {
      await dialog.getByRole("button", { name: locale === "fa" ? "ماه بعد" : "Next month", exact: true }).click();
    }
    return dialog.locator(`[data-date="${iso}"]`);
  }

  for (const origin of ["http://localhost:3001", "http://localhost:3011"]) {
    for (const locale of ["fa", "en"]) {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto(`${origin}/${locale}/listings/${listing.id}`);
      const box = page.locator(`aside[aria-label="${locale === "fa" ? "قیمت" : "Price"}"]`);
      await box.getByRole("button", { name: locale === "fa" ? /^تاریخ سفر/ : /^Dates/ }).click();
      const dialog = page.getByRole("dialog");
      const first = await goToDate(dialog, start, locale);
      await expect(first.locator("[data-day-price]")).toHaveText(locale === "fa" ? "۲٫۶" : "2.6");
      await expect(first).toHaveAttribute("data-price-source", "weekend");
      await first.click();
      const last = await goToDate(dialog, end, locale);
      await expect(last).toBeEnabled(); // checkout is allowed on the first booked night
      await last.click();
      await expect(last.locator("[data-day-price]")).toHaveText(locale === "fa" ? "خروج" : "Check-out");
      const confirmColors = await dialog.getByRole("button", { name: locale === "fa" ? "تأیید تاریخ‌ها" : "Confirm dates", exact: true }).evaluate(el => ({ background: getComputedStyle(el).backgroundColor, color: getComputedStyle(el).color }));
      await expect.poll(() => last.evaluate(el => ({ background: getComputedStyle(el).backgroundColor, color: getComputedStyle(el).color }))).toEqual(confirmColors);
      const summary = dialog.getByRole("region", { name: locale === "fa" ? "خلاصهٔ اقامت" : "Stay summary" });
      await expect(summary.getByText(locale === "fa" ? "۶٬۵۰۰٬۰۰۰ تومان" : "6,500,000 Toman", { exact: true })).toBeVisible();
      await expect(summary.getByText(locale === "fa" ? "۳ شب" : "3 nights", { exact: true })).toBeVisible();
      await expect(box.locator(`button[aria-label^="${locale === "fa" ? "تاریخ سفر" : "Dates"}"]`)).toContainText(locale === "fa" ? "هر تاریخی" : "Any dates");
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        const sizes = await dialog.evaluate(el => ({ content: el.scrollWidth, width: el.clientWidth, bounds: el.getBoundingClientRect().toJSON() }));
        expect(sizes.content, `${origin}/${locale} dialog at ${width}`).toBeLessThanOrEqual(sizes.width);
        expect(sizes.bounds.left).toBeGreaterThanOrEqual(0);
        expect(sizes.bounds.right).toBeLessThanOrEqual(width);
      }
      await page.addScriptTag({ path: path.join(__dirname, "../node_modules/axe-core/axe.min.js") });
      for (const width of [390, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        const errors = await page.evaluate(async () => {
          // @ts-expect-error axe is injected above
          const result = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } });
          return result.violations.map((v: { id: string; nodes: { target: string[] }[] }) => ({ id: v.id, nodes: v.nodes.map(n => n.target) }));
        });
        expect(errors, `${origin}/${locale} at ${width}`).toEqual([]);
      }
      if (process.env.PRICED_CALENDAR_SHOTS && origin.endsWith("3011")) {
        await page.screenshot({ path: `/private/tmp/guest-price-calendar-${locale}-desktop.png` });
        if (locale === "fa") await dialog.screenshot({ path: path.resolve(__dirname, "../../docs/images/readme/guest-price-calendar.jpg"), type: "jpeg", quality: 90 });
        await page.setViewportSize({ width: 390, height: 1000 });
        await page.screenshot({ path: `/private/tmp/guest-price-calendar-${locale}-mobile.png` });
        await page.setViewportSize({ width: 1440, height: 1000 });
      }
      await dialog.getByRole("button", { name: locale === "fa" ? "تأیید تاریخ‌ها" : "Confirm dates", exact: true }).click();
      await expect(dialog).toBeHidden();
      await expect(box.getByText(locale === "fa" ? "۶٬۵۰۰٬۰۰۰ تومان" : "6,500,000 Toman", { exact: true })).toBeVisible();
      await expect(page.locator(`section[aria-labelledby="calendar-title"] [data-date="${end}"] [data-day-price]`)).toHaveText(locale === "fa" ? "خروج" : "Check-out");
    }
  }
});
