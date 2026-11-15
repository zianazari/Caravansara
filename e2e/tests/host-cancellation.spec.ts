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
  test(`host sees guest contact and cancels a confirmed booking (${locale})`, async ({
    page,
    request,
    browser,
  }) => {
    test.setTimeout(90_000);
    const fa = locale === "fa";
    const signup = await page.request.post(`${WEB}/session/register`, {
      headers: { origin: WEB },
      data: {
        email: `e2e.cancelhost.${randomUUID()}@caravansara.example.com`,
        password: PASSWORD,
        full_name: "Contact host",
      },
    });
    expect(signup.status()).toBe(201);
    const signed = await signup.json();
    const host = {
      id: signed.user.id,
      email: signed.user.email,
      token: signed.access_token,
      refresh: "",
    };
    await page.goto(`${WEB}/${locale}/account`);
    const mobile = page.getByLabel(
      fa ? "شمارهٔ موبایل (اختیاری)" : "Mobile number (optional)",
    );
    await mobile.fill("۰۹۱۲۱۲۳۴۵۶۷");
    const saved = page.waitForResponse(
      (r) => r.url().endsWith("/api/v1/me") && r.request().method() === "PATCH",
    );
    await page
      .getByRole("button", { name: fa ? "ذخیره" : "Save", exact: true })
      .click();
    expect((await (await saved).json()).phone_number).toBe("+989121234567");
    const guest = await register(request, "contactguest");
    expect(
      (
        await request.patch(`${API}/me`, {
          headers: auth(guest),
          data: { phone_number: "+447700900123" },
        })
      ).status(),
    ).toBe(200);
    const stranger = await register(request, "contactoutsider");
    const listing = await createListing(request, host, {
      title: "Host contact and cancellation",
    });
    const reserved = await reserve(request, guest, listing.id);
    expect(reserved.status()).toBe(201);
    const booking = await reserved.json();
    const paid = await request.post(`${API}/bookings/${booking.id}/pay`, {
      headers: auth(guest),
    });
    expect(paid.status()).toBe(200);
    expect((await paid.json()).guest_contact).toBeNull();
    expect(
      (
        await request.get(`${API}/bookings/${booking.id}`, {
          headers: auth(stranger),
        })
      ).status(),
    ).toBe(404);
    await page.goto(
      `${WEB}/${locale}/host/listings/${listing.id}?tab=bookings`,
    );
    const email = page.getByRole("link", {
      name: new RegExp(fa ? "ارسال ایمیل به" : "Email "),
    });
    await expect(email).toHaveText(guest.email);
    await expect(email).toHaveAttribute(
      "href",
      `mailto:${encodeURIComponent(guest.email)}`,
    );
    await expect(
      page.getByRole("link", {
        name: fa ? /تماس با E2E contactguest/ : /Call E2E contactguest/,
      }),
    ).toHaveAttribute("href", "tel:+447700900123");
    const guestContext = await browser.newContext();
    const guestPage = await guestContext.newPage();
    try {
      const login = await guestPage.request.post(`${WEB}/session/login`, {
        headers: { origin: WEB },
        data: { email: guest.email, password: PASSWORD },
      });
      expect(login.status()).toBe(200);
      await guestPage.goto(`${WEB}/${locale}/trips/${booking.id}`);
      await expect(
        guestPage.getByRole("link", {
          name: fa
            ? "تماس با Contact host +989121234567"
            : "Call Contact host +989121234567",
        }),
      ).toHaveAttribute("href", "tel:+989121234567");
    } finally {
      await guestContext.close();
    }
    const cancel = page.getByRole("button", {
      name: fa ? "لغو رزرو" : "Cancel booking",
      exact: true,
    });
    await cancel.click();
    const dialog = page.getByRole("dialog");
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
      .getByRole("button", {
        name: fa ? "نه، نگه دار" : "No, keep it",
        exact: true,
      })
      .click();
    expect(
      (
        await (
          await request.get(`${API}/bookings/${booking.id}`, {
            headers: auth(guest),
          })
        ).json()
      ).status,
    ).toBe("confirmed");
    await cancel.click();
    await page
      .getByRole("dialog")
      .getByRole("button", {
        name: fa ? "بله، لغو شود" : "Yes, cancel",
        exact: true,
      })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(cancel).toHaveCount(0);
    await expect(email).toHaveText(guest.email);
    const after = await request.get(`${API}/bookings/${booking.id}`, {
      headers: auth(guest),
    });
    expect(after.headers()["cache-control"]).toBe("no-store");
    const data = await after.json();
    expect(data.status).toBe("cancelled");
    expect(data.guest_contact).toBeNull();
    expect(
      (
        await request.delete(`${API}/listings/${listing.id}`, {
          headers: auth(host),
        })
      ).status(),
    ).toBe(204);
  });
}
