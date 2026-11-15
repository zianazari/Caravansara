import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import path from "node:path";
import {
  API,
  WEB,
  PASSWORD,
  auth,
  createListing,
  register,
  reserve,
} from "./helpers";

test.use({ extraHTTPHeaders: {} });
for (const locale of ["fa", "en"]) {
  test(`host confirms deletion and cannot delete a booked listing (${locale})`, async ({
    page,
    request,
  }) => {
    test.setTimeout(90_000);
    const fa = locale === "fa";
    const res = await page.request.post(`${WEB}/session/register`, {
      headers: { origin: WEB },
      data: {
        email: `e2e.delete.${randomUUID()}@caravansara.example.com`,
        password: PASSWORD,
        full_name: "Deletion host",
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    const host = {
      id: body.user.id,
      email: body.user.email,
      token: body.access_token,
      refresh: "",
    };
    const disposable = await createListing(
      request,
      host,
      { title: "Delete this listing" },
      { approved: false },
    );
    const booked = await createListing(request, host, {
      title: "Keep booked listing",
    });
    const guest = await register(request, "deleteguest");
    const hold = await reserve(request, guest, booked.id);
    expect(hold.status()).toBe(201);
    const booking = await hold.json();
    await page.goto(`${WEB}/${locale}/host`);
    const card = page.getByRole("article").filter({
      has: page.getByRole("link", {
        name: "Delete this listing",
        exact: true,
      }),
    });
    const label = fa ? "حذف آگهی" : "Delete listing";
    await card.getByRole("button", { name: label }).click();
    let dialog = page.getByRole("dialog");
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
    }
    await page.addScriptTag({
      path: path.join(__dirname, "../node_modules/axe-core/axe.min.js"),
    });
    const violations = await page.evaluate(async () => {
      const axe = (window as unknown as { axe: typeof import("axe-core") }).axe;
      const result = await axe.run(document, {
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"],
        },
      });
      return result.violations.map((violation) => violation.id);
    });
    expect(violations).toEqual([]);
    await dialog
      .getByRole("button", { name: fa ? "انصراف" : "Cancel", exact: true })
      .click();
    expect(
      (
        await request.get(`${API}/listings/${disposable.id}`, {
          headers: auth(host),
        })
      ).status(),
    ).toBe(200);
    await card.getByRole("button", { name: label }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: label, exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(card).toHaveCount(0);
    expect(
      (
        await request.get(`${API}/listings/${disposable.id}`, {
          headers: auth(host),
        })
      ).status(),
    ).toBe(404);
    const kept = page.getByRole("article").filter({
      has: page.getByRole("link", {
        name: "Keep booked listing",
        exact: true,
      }),
    });
    await kept.getByRole("button", { name: label }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: label, exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText(
      fa ? "تعیین تکلیف" : "Resolve them",
    );
    await page
      .getByRole("dialog")
      .getByRole("button", { name: fa ? "انصراف" : "Cancel", exact: true })
      .click();
    await expect(kept).toBeVisible();
    expect(
      (
        await request.post(`${API}/bookings/${booking.id}/cancel`, {
          headers: auth(guest),
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await request.delete(`${API}/listings/${booked.id}`, {
          headers: auth(host),
        })
      ).status(),
    ).toBe(204);
  });
}
