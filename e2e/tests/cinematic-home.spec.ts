import { expect, test } from "@playwright/test";
import path from "node:path";
import { createListing, register } from "./helpers";

const origin = process.env.CINEMATIC_WEB ?? "http://localhost:3011";
test.use({ extraHTTPHeaders: {} });

for (const locale of ["fa", "en"] as const) {
  test(`cinematic ${locale}: responsive design and functional search`, async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.goto(`${origin}/${locale}`);
    await expect(page.locator("html")).toHaveAttribute(
      "data-design",
      "cinematic",
    );
    await expect(page.locator("#hero-title")).toContainText(
      locale === "fa" ? "کمی دورتر" : "A little further",
    );
    await page.setViewportSize({ width: 1440, height: 1000 });
    await expect(page.locator('header a[href="#stays"]')).toHaveCount(0);
    const search = page.getByRole("search");
    await expect(search).toContainText(
      locale === "fa" ? "هر تاریخی" : "Any dates",
    );
    const sections = search.locator(":scope > div");
    await sections.nth(0).click({ position: { x: 5, y: 50 } });
    await expect(search.getByRole("combobox")).toBeFocused();
    await page.keyboard.press("Escape");
    await sections.nth(1).click({ position: { x: 5, y: 50 } });
    await expect(page.getByRole("grid")).toBeVisible();
    await page.keyboard.press("Escape");
    for (const target of [
      sections.nth(1).locator(".field-label"),
      sections.nth(1).locator(".field-label svg"),
    ]) {
      await target.click();
      await expect(page.getByRole("grid")).toBeVisible();
      await page.keyboard.press("Escape");
    }
    await sections.nth(2).click({ position: { x: 5, y: 50 } });
    await expect(
      page.locator("input[inputmode=numeric]").first(),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    const cover = page.locator(".cinematic-cover img");
    await expect(cover).toHaveJSProperty("complete", true);
    expect(
      await cover.evaluate((el) => (el as HTMLImageElement).naturalWidth),
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
    if (process.env.CINEMATIC_SHOTS) {
      await page.screenshot({
        path: `/private/tmp/cinematic-${locale}-desktop.png`,
      });
      await page.setViewportSize({ width: 390, height: 900 });
      await page.screenshot({
        path: `/private/tmp/cinematic-${locale}-mobile.png`,
      });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    const destinations = page.locator("#popular-destinations");
    await expect(
      destinations.getByRole("heading", {
        name: locale === "fa" ? "مقصدهای محبوب" : "Popular destinations",
      }),
    ).toBeVisible();
    const response = await page.request.get(
      `${origin}/api/v1/cities?sort=popular&country=IR&limit=3`,
    );
    const cities = await response.json();
    const cards = destinations.getByRole("link");
    await expect(cards).toHaveCount(cities.length);
    for (let i = 0; i < cities.length; i++) {
      const href = await cards.nth(i).getAttribute("href");
      expect(new URL(href!, origin).searchParams.get("city_id")).toBe(
        String(cities[i].id),
      );
    }
    if (process.env.CINEMATIC_SHOTS) {
      await destinations.scrollIntoViewIfNeeded();
      await expect
        .poll(() =>
          destinations
            .locator("img")
            .first()
            .evaluate((el) => (el as HTMLImageElement).naturalWidth),
        )
        .toBeGreaterThan(0);
      await destinations.screenshot({
        path: `/private/tmp/cinematic-${locale}-destinations.png`,
      });
    }
    await cards.first().click();
    await expect(page).toHaveURL(
      new RegExp(`/search\\?.*city_id=${cities[0].id}`),
    );
    await expect(page.locator("html")).toHaveAttribute(
      "data-design",
      "cinematic",
    );
  });
}

for (const locale of ["fa", "en"] as const) {
  test(`category changes preserve page position (${locale})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${origin}/${locale}`);
    const categories = page.getByRole("navigation", {
      name: locale === "fa" ? "دسته‌ها" : "Categories",
    });
    await categories.scrollIntoViewIfNeeded();
    await expect(page.getByRole("article").first()).toBeVisible();
    await page.evaluate(() => {
      const nav = document.querySelector("#stays nav")!;
      window.scrollTo({
        top: window.scrollY + nav.getBoundingClientRect().top - 250,
        behavior: "instant",
      });
    });
    const before = await page.evaluate(() => window.scrollY);
    expect(before).toBeGreaterThan(500);
    for (const [category, label] of [
      ["entire_place", locale === "fa" ? "کل اقامتگاه" : "Entire place"],
      ["private_room", locale === "fa" ? "اتاق خصوصی" : "Private room"],
      ["all", locale === "fa" ? "همه" : "All"],
    ]) {
      const link = categories.getByRole("link", { name: label, exact: true });
      await link.click();
      await expect(link).toHaveAttribute("aria-current", "true");
      await expect(categories).toBeInViewport();
      // Filtered result heights may clamp scrolling; the categories must remain visible without returning to the top.
      expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(500);
    }
  });
}

test("map prices keep their position and size on hover", async ({ page, request }) => {
  const host = await register(request, "maphover");
  await page.setViewportSize({ width: 1440, height: 1000 });
  const cities = await (
    await page.request.get(`${origin}/api/v1/cities?q=Tehran`)
  ).json();
  const city = cities.find((c: { name: string }) => c.name === "Tehran");
  await createListing(request, host, { title: "E2E map hover place", city_id: city.id, latitude: 35.72, longitude: 51.4, currency: "IRR" });
  await page.goto(`${origin}/fa/search?city_id=${city.id}`);
  const pins = page.locator("a.maplibregl-marker");
  await expect(pins.last()).toBeVisible({ timeout: 20000 });
  await pins.last().scrollIntoViewIfNeeded();
  const index = await pins.evaluateAll((elements) => {
    let found = -1;
    elements.forEach((el, i) => {
      const b = el.getBoundingClientRect();
      if (
        document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2) === el
      )
        found = i;
    });
    return found;
  });
  expect(index).toBeGreaterThanOrEqual(0);
  const pin = pins.nth(index);
  const before = await pin.boundingBox();
  await pin.hover();
  await expect(pin).toHaveCSS("background-color", "rgb(255, 139, 80)");
  const after = await pin.boundingBox();
  for (const key of ["x", "y", "width", "height"] as const) {
    expect(Math.abs(after![key] - before![key]), `marker ${key}`).toBeLessThan(
      0.5,
    );
  }
});

test("profile header shows the complete user name at every width", async ({
  page,
}) => {
  const name = "سید محمدرضا موسوی نیک‌اندیش کاشانی";
  const registered = await page.request.post(`${origin}/session/register`, {
    headers: { origin },
    data: {
      email: `header.${crypto.randomUUID()}@caravansara.example.com`,
      password: "E2e-Pass-2026!",
      full_name: name,
    },
  });
  expect(registered.status(), await registered.text()).toBe(201);
  await page.goto(`${origin}/fa`);
  const profile = page.getByRole("button", {
    name: `حساب من: ${name}`,
    exact: true,
  });
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(profile.locator("bdi")).toHaveText(name);
    await expect(profile.locator("bdi")).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    expect(
      await profile
        .locator("bdi")
        .evaluate(
          (el) =>
            el.parentElement!.scrollWidth <= el.parentElement!.clientWidth,
        ),
    ).toBe(true);
  }
  const avatar = profile.getByRole("img", { name, exact: true });
  await expect(avatar.locator("svg")).toBeVisible();
  await expect(avatar).toHaveText("");
  await expect(avatar).toHaveCSS("background-color", "rgb(255, 139, 80)");
  await profile.click();
  await expect(page.getByRole("menu")).toBeVisible();
});

test("listing location uses a house marker that follows coordinate edits", async ({
  page,
}) => {
  const response = await page.request.post(`${origin}/session/register`, {
    headers: { origin },
    data: {
      email: `house-marker.${crypto.randomUUID()}@caravansara.example.com`,
      password: "E2e-Pass-2026!",
      full_name: "E2E House Marker",
    },
  });
  expect(response.status(), await response.text()).toBe(201);
  await page.goto(`${origin}/fa/host/new`);
  await page.getByRole("radio", { name: /کل اقامتگاه/ }).check();
  await page.getByRole("button", { name: "بعدی", exact: true }).click();
  await page.getByRole("combobox", { name: "شهر", exact: true }).fill("Tehran");
  await page.getByRole("option", { name: /تهران/ }).first().click();
  const map = page.getByTestId("map");
  await expect(map.locator("canvas")).toBeVisible();
  await map.click();
  const marker = map.locator('[data-map-marker="house"]');
  await expect(marker.locator("svg")).toBeVisible();
  const latitude = page.getByRole("spinbutton", { name: "عرض جغرافیایی" });
  await expect(latitude).not.toHaveValue("");
  await latitude.fill("35.72");
  await expect(latitude).toHaveValue("35.72");
  await expect(marker).toBeVisible();
});
