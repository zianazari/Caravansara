import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
import { API, PASSWORD, WEB, auth, createAdmin, adminLogin, createListing, day, register, type User } from "./helpers";

test.use({ extraHTTPHeaders: {} });
test.describe.configure({ mode: "serial", timeout: 180_000 });
const ADMIN = process.env.ADMIN_WEB_URL ?? "http://admin.localhost:3001";
const AXE = path.join(__dirname, "..", "node_modules", "axe-core", "axe.min.js");
let host: User;
let guest: User;
let listingId: number;
let admin: { email: string; password: string };
let adminHeaders: Record<string, string>;

async function login(page: Page, user: User) {
  const res = await page.request.post(`${WEB}/session/login`, { headers: { origin: WEB }, data: { email: user.email, password: PASSWORD } });
  expect(res.status(), await res.text()).toBe(200);
}

async function selectDate(page: Page, label: string, iso: string) {
  await page.getByRole("button", { name: new RegExp(`^${label}`) }).click();
  const popup = page.getByRole("dialog");
  for (let i = 0; i < 24 && !(await popup.locator(`[data-date="${iso}"]`).count()); i++) {
    await popup.getByRole("button", { name: "Next month" }).click();
  }
  await popup.locator(`[data-date="${iso}"]`).click();
  await expect(popup).toBeHidden();
}

test.beforeAll(async ({ request }) => {
  host = await register(request, "pricinghost");
  guest = await register(request, "pricingguest");
  admin = createAdmin("pricingcalendar");
  adminHeaders = await adminLogin(request, admin.email);
  const listing = await createListing(request, host, { title: "E2E dynamic pricing place", price_per_night: "100.00", cleaning_fee: "15.00" });
  listingId = listing.id;
});

test("the host saves rules and the guest books the exact daily quote", async ({ page, request }) => {
  const start = day(20);
  const end = day(24);
  const holiday = day(21);
  const existing = await request.get(`${API}/holidays`, { params: { country: "NL", start: holiday, end: day(22) } });
  const prior = (await existing.json())[0] as { name: string } | undefined;
  try {
    expect((await request.put(`${API}/admin/holidays/NL/${holiday}`, { headers: adminHeaders, data: { name: "E2E holiday" } })).status()).toBe(200);
    expect((await request.put(`${API}/listings/${listingId}/pricing`, { headers: auth(host), data: { weekend_enabled: true, weekend_days: [0, 1, 2, 3, 4, 5, 6], weekend_percent: 30, holiday_enabled: true, holiday_percent: 100 } })).status()).toBe(200);
    await login(page, host);
    await page.goto(`${WEB}/en/host/listings/${listingId}?tab=pricing`);
    await expect(page.getByRole("heading", { name: "Nightly price calendar" })).toBeVisible();
    await expect(page.getByRole("checkbox", { name: "Weekend pricing" })).toBeChecked();
    await page.getByLabel("Price adjustment (%)", { exact: true }).nth(0).fill("40");
    await page.getByRole("button", { name: "Add date range" }).click();
    await page.getByLabel("Range name").fill("E2E custom discount");
    await selectDate(page, "Start date", day(22));
    await selectDate(page, "End date", day(22));
    await page.getByLabel("Price adjustment (%)", { exact: true }).nth(2).fill("-20");
    const save = page.waitForResponse((r) => r.request().method() === "PUT" && r.url().endsWith(`/listings/${listingId}/pricing`));
    await page.getByRole("button", { name: "Save pricing", exact: true }).click();
    expect((await save).status()).toBe(200);
    await expect(page.getByRole("button", { name: "Save pricing", exact: true })).toBeDisabled();
    const quote = await request.get(`${API}/listings/${listingId}/pricing/quote`, { params: { check_in: start, check_out: end } });
    expect(quote.status()).toBe(200);
    const prices = await quote.json();
    expect(prices.nights.map((n: { source: string }) => n.source)).toEqual(["weekend", "holiday", "custom", "weekend"]);
    expect(Number(prices.total_price)).toBe(575);
    await login(page, guest);
    await page.goto(`${WEB}/en/listings/${listingId}?check_in=${start}&check_out=${end}&adults=1`);
    const box = page.getByRole("complementary", { name: "Price" });
    await expect(box.getByText("€575.00", { exact: true })).toBeVisible();
    await box.getByRole("button", { name: "Reserve", exact: true }).click();
    await page.waitForURL(new RegExp(`/en/book/${listingId}$`));
    await expect(page.getByText("€575.00", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Hold these dates" }).click();
    await page.waitForURL(/\/en\/trips\/\d+$/);
    const bookingId = Number(page.url().split("/").at(-1));
    const booking = await request.get(`${API}/bookings/${bookingId}`, { headers: auth(guest) });
    expect((await booking.json()).nightly_prices).toEqual(prices.nights);
    expect((await request.put(`${API}/listings/${listingId}/pricing`, { headers: auth(host), data: {} })).status()).toBe(200);
    await page.getByRole("button", { name: "Pay €575.00" }).click();
    await page.waitForURL(new RegExp(`/en/trips/${bookingId}/receipt$`));
    await expect(page.getByText("€575.00", { exact: true }).first()).toBeVisible();
    await page.getByText("Nightly price details", { exact: true }).click();
    await expect(page.getByText("Custom · E2E custom discount")).toBeVisible();
  } finally {
    if (prior) await request.put(`${API}/admin/holidays/NL/${holiday}`, { headers: adminHeaders, data: { name: prior.name } });
    else await request.delete(`${API}/admin/holidays/NL/${holiday}`, { headers: adminHeaders });
  }
});

test("modern host and admin panels fit phones and remain accessible in Persian and English", async ({ page, request }) => {
  await login(page, host);
  for (const locale of ["fa", "en"]) {
    for (const route of ["/host", "/host/new", `/host/listings/${listingId}?tab=pricing`]) {
      await page.goto(`${WEB}/${locale}${route}`);
      await page.waitForLoadState("networkidle");
      for (const width of [320, 390, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        const sizes = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
        expect(sizes[0], `${locale}${route} at ${width}`).toBeLessThanOrEqual(sizes[1]);
      }
      await page.addScriptTag({ path: AXE });
      const errors = await page.evaluate(async () => {
        // @ts-expect-error axe is loaded above
        const results = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } });
        return results.violations.map((v: { id: string }) => v.id);
      });
      expect(errors, `${locale}${route}`).toEqual([]);
      if (process.env.PRICING_SHOTS) await page.screenshot({ path: `/private/tmp/pricing-${locale}-${route === "/host/new" ? "wizard" : route === "/host" ? "host" : "calendar"}.png`, fullPage: true });
    }
  }
  await page.goto(`${ADMIN}/en/admin/login`);
  await page.getByLabel("Email").fill(admin.email);
  await page.getByLabel("Password").fill(admin.password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.waitForURL(/\/en\/admin$/);
  await page.getByRole("tab", { name: "Holidays & pricing" }).click();
  await expect(page.getByRole("heading", { name: "Holiday calendar" })).toBeVisible();
  const date = day(4);
  const previous = await request.get(`${API}/holidays`, { params: { country: "NL", start: date, end: day(5) } });
  const prior = (await previous.json())[0] as { name: string } | undefined;
  try {
    await page.getByRole("combobox", { name: "Country" }).click();
    await page.getByRole("option", { name: "Netherlands", exact: true }).click();
    await selectDate(page, "Holiday date", date);
    await page.getByLabel("Holiday name").fill("E2E admin calendar fixture");
    await page.getByRole("button", { name: "Save holiday", exact: true }).click();
    await expect(page.getByText("E2E admin calendar fixture", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: /^Remove: E2E admin calendar fixture/ }).click();
    await expect(page.getByText("E2E admin calendar fixture", { exact: true })).toHaveCount(0);
    for (const locale of ["fa", "en"]) {
      await page.goto(`${ADMIN}/${locale}/admin?tab=holidays`);
      await page.waitForLoadState("networkidle");
      for (const width of [320, 390, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        const sizes = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
        expect(sizes[0]).toBeLessThanOrEqual(sizes[1]);
      }
      await page.addScriptTag({ path: AXE });
      const errors = await page.evaluate(async () => {
        // @ts-expect-error axe is loaded above
        const result = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } });
        return result.violations.map((v: { id: string }) => v.id);
      });
      expect(errors, `admin holidays ${locale}`).toEqual([]);
      if (process.env.PRICING_SHOTS) await page.screenshot({ path: `/private/tmp/pricing-${locale}-admin.png`, fullPage: true });
    }
  } finally {
    if (prior) await request.put(`${API}/admin/holidays/NL/${date}`, { headers: adminHeaders, data: { name: prior.name } });
    else await request.delete(`${API}/admin/holidays/NL/${date}`, { headers: adminHeaders });
  }
});
