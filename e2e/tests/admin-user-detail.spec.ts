import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import path from "node:path";
import {
  API,
  auth,
  createAdmin,
  createListing,
  register,
  reserve,
} from "./helpers";

const ADMIN = process.env.ADMIN_WEB_URL ?? "http://admin.localhost:3001";
test.use({ extraHTTPHeaders: {} });
for (const locale of ["fa", "en"]) {
  test(`admin opens user mobile, bookings in both roles and retained listings (${locale})`, async ({
    page,
    request,
  }) => {
    test.setTimeout(90_000);
    const fa = locale === "fa";
    const name = `profile-${randomUUID().slice(0, 8)}`;
    const user = await register(request, name);
    const guest = await register(request, "profile-guest");
    expect(
      (
        await request.patch(`${API}/me`, {
          headers: auth(user),
          data: { phone_number: "09123456789" },
        })
      ).status(),
    ).toBe(200);
    const owned = await createListing(request, user, {
      title: "E2E owned profile home",
    });
    const removed = await createListing(
      request,
      user,
      { title: "E2E archived profile home" },
      { approved: false },
    );
    expect(
      (
        await request.delete(`${API}/listings/${removed.id}`, {
          headers: auth(user),
        })
      ).status(),
    ).toBe(204);
    const other = await createListing(request, guest, {
      title: "E2E guest profile home",
    });
    const received = await reserve(request, guest, owned.id);
    const sent = await reserve(request, user, other.id);
    expect(received.status()).toBe(201);
    expect(sent.status()).toBe(201);
    const receivedId = (await received.json()).id;
    const sentId = (await sent.json()).id;
    // Terminal bookings remain available for admin support without leaving holds behind.
    expect(
      (
        await request.post(`${API}/bookings/${receivedId}/cancel`, {
          headers: auth(guest),
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await request.post(`${API}/bookings/${sentId}/cancel`, {
          headers: auth(user),
        })
      ).status(),
    ).toBe(200);
    const admin = createAdmin(`user-detail-${locale}`);
    const login = await page.request.post(`${ADMIN}/admin-api/login`, {
      headers: { origin: ADMIN },
      data: admin,
    });
    expect(login.status()).toBe(200);
    await page.goto(
      `${ADMIN}/${locale}/admin?tab=users&q=${encodeURIComponent(name)}`,
    );
    await expect(
      page.getByRole("link", { name: `E2E ${name}`, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", {
        name: fa
          ? `تماس با E2E ${name} +989123456789`
          : `Call E2E ${name} +989123456789`,
      }),
    ).toHaveAttribute("href", "tel:+989123456789");
    await page.getByRole("link", { name: `E2E ${name}`, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/users/${user.id}$`));
    await expect(
      page.getByRole("heading", { name: `E2E ${name}` }),
    ).toBeVisible();
    await expect(
      page.getByText(fa ? "به‌عنوان میزبان" : "As host"),
    ).toBeVisible();
    await expect(
      page.getByText(fa ? "به‌عنوان مهمان" : "As guest"),
    ).toBeVisible();
    await expect(page.locator("tbody tr")).toHaveCount(2);
    await page.reload();
    await expect(page.locator("tbody tr")).toHaveCount(2);
    await page
      .getByRole("link", {
        name: fa ? "آگهی‌های کاربر" : "User listings",
        exact: true,
      })
      .click();
    await expect(
      page.getByText(fa ? "حذف‌شده" : "Deleted", { exact: true }),
    ).toBeVisible();
    await expect(page.locator("tbody tr")).toHaveCount(2);
    await expect(
      page.getByRole("link", { name: "E2E guest profile home" }),
    ).toHaveCount(0);
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    await page.addScriptTag({
      path: path.join(
        __dirname,
        "..",
        "node_modules",
        "axe-core",
        "axe.min.js",
      ),
    });
    const violations = await page.evaluate(async () => {
      const axe = (window as unknown as { axe: typeof import("axe-core") }).axe;
      const result = await axe.run(document, {
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
        },
      });
      return result.violations.map((v) => v.id);
    });
    expect(violations).toEqual([]);
    await page.screenshot({
      path: `/private/tmp/caravansara-admin-user-${locale}.png`,
      fullPage: true,
    });
    await page.getByRole("link", { name: "E2E archived profile home" }).click();
    await expect(
      page.getByRole("heading", {
        name: "E2E archived profile home",
        exact: true,
      }),
    ).toBeVisible();
  });
}
