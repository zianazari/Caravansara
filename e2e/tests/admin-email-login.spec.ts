import { expect, test } from "@playwright/test";
import path from "node:path";
import { WEB, createAdmin } from "./helpers";

const ADMIN = process.env.ADMIN_WEB_URL ?? "http://admin.localhost:3001";
const MAILPIT = process.env.MAILPIT_URL ?? "http://localhost:8025";
test.use({ extraHTTPHeaders: {} });

for (const locale of ["fa", "en"]) {
  test(`admin signs in by email with protected cookies in ${locale}`, async ({
    page,
    request,
  }) => {
    const fa = locale === "fa";
    const admin = createAdmin(`emailadmin-${locale}`);
    await page.goto(`${ADMIN}/${locale}/admin/login`);
    await expect(
      page.getByLabel(fa ? "رمز" : "Password", { exact: true }),
    ).toHaveCount(0);
    await page
      .getByLabel(fa ? "ایمیل" : "Email", { exact: true })
      .fill(admin.email);
    await page
      .getByRole("button", {
        name: fa ? "ارسال کد ورود" : "Send sign-in code",
        exact: true,
      })
      .click();
    const input = page.getByLabel(fa ? "کد ۵ رقمی" : "5-digit code", {
      exact: true,
    });
    await expect(input).toBeFocused();
    await expect(page.locator("[data-code-slot]")).toHaveCount(5);
    expect(
      (await page.context().cookies()).find((c) => c.name === "cv_admin"),
    ).toBeUndefined();
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
      // @ts-expect-error injected axe in a real browser
      const result = await window.axe.run(document, {
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"],
        },
      });
      return result.violations.map((v: { id: string }) => v.id);
    });
    expect(violations).toEqual([]);
    let messageId: string | undefined;
    await expect
      .poll(
        async () => {
          const messages = await (
            await request.get(`${MAILPIT}/api/v1/search`, {
              params: { query: `to:"${admin.email}"` },
            })
          ).json();
          messageId = messages.messages.find(
            (m: { Subject: string }) =>
              m.Subject ===
              (fa
                ? "کد ورود به مدیریت کاروانسرا"
                : "Your Caravansara admin sign-in code"),
          )?.ID;
          return messageId;
        },
        { timeout: 20_000 },
      )
      .toBeTruthy();
    const mail = await (
      await request.get(`${MAILPIT}/api/v1/message/${messageId}`)
    ).json();
    const code: string = mail.Text.match(/\b[0-9]{5}\b/)?.[0];
    expect(code).toMatch(/^[0-9]{5}$/);
    const submit = page.getByRole("button", {
      name: fa ? "تأیید کد و ورود" : "Verify code and sign in",
      exact: true,
    });
    await input.fill(code === "00000" ? "99999" : "00000");
    await submit.click();
    await expect(page.locator("form [role=alert]")).toContainText(
      fa ? "کد درست نیست" : "The code is incorrect",
    );
    await input.fill(
      fa ? [...code].map((d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]).join("") : code,
    );
    const verified = page.waitForResponse((r) =>
      r.url().endsWith("/admin-api/email-code/verify"),
    );
    await submit.click();
    const response = await verified;
    expect(response.status()).toBe(200);
    expect(Object.keys(await response.json())).toEqual(["session_expires_in"]);
    await expect(page).toHaveURL(`${ADMIN}/${locale}/admin`);
    const heading = page.getByRole("heading", {
      name: fa ? "صف بازبینی" : "Review queue",
      exact: true,
    });
    await expect(heading).toBeVisible();
    for (const name of ["cv_admin", "cv_admin_refresh"]) {
      expect(
        (await page.context().cookies()).find((c) => c.name === name),
      ).toMatchObject({
        httpOnly: true,
        sameSite: "Strict",
        path: "/admin-api",
      });
    }
    expect(await page.evaluate(() => document.cookie)).not.toContain(
      "cv_admin",
    );
    const before = (await page.context().cookies()).find(
      (c) => c.name === "cv_admin_refresh",
    )!.value;
    await page.context().clearCookies({ name: "cv_admin" });
    await page.reload();
    await expect(heading).toBeVisible();
    const after = (await page.context().cookies()).find(
      (c) => c.name === "cv_admin_refresh",
    )!.value;
    expect(after).not.toBe(before);
    expect(
      (
        await request.post(`${WEB}/admin-api/email-code/request`, {
          data: { email: admin.email },
        })
      ).status(),
    ).toBe(404);
  });
}
