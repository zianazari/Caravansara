import { expect, test } from "@playwright/test";
import path from "node:path";
import { API, WEB, register } from "./helpers";

const MAILPIT = process.env.MAILPIT_URL ?? "http://localhost:8025";
test.use({ extraHTTPHeaders: {} });

test("five-digit email codes arrive through the current SMTP server and sign in on the unified site", async ({
  page,
  request,
}) => {
  test.setTimeout(180_000);
  for (const origin of [WEB]) {
    for (const locale of ["fa", "en"]) {
      const fa = locale === "fa";
      const user = await register(request, "emaillogin");
      await page.context().clearCookies();
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto(
        `${origin}/${locale}/login?returnTo=${encodeURIComponent(`/${locale}/account`)}`,
      );
      await page
        .getByRole("button", {
          name: fa ? "ایمیل" : "Email",
          exact: true,
        })
        .click();
      await expect(
        page.getByLabel(fa ? "رمز" : "Password", { exact: true }),
      ).toHaveCount(0);
      await page
        .getByLabel(fa ? "ایمیل" : "Email", { exact: true })
        .fill(user.email.toUpperCase());
      const sent = page.waitForResponse((r) =>
        r.url().endsWith("/session/email-code/request"),
      );
      await page
        .getByRole("button", {
          name: fa ? "ارسال کد ورود" : "Send sign-in code",
          exact: true,
        })
        .click();
      const response = await sent;
      expect(response.status()).toBe(200);
      const challenge = await response.json();
      expect(Object.keys(challenge).sort()).toEqual([
        "challenge_id",
        "expires_in",
        "resend_after",
      ]);
      await expect(
        page.getByRole("button", {
          name: fa ? /^ارسال دوباره تا / : /^Resend in /,
        }),
      ).toBeDisabled();
      const subject = fa
        ? "کد ورود به کاروانسرا"
        : "Your Caravansara sign-in code";
      let id: string | undefined;
      await expect
        .poll(
          async () => {
            const result = await request.get(`${MAILPIT}/api/v1/search`, {
              params: { query: `to:"${user.email}"` },
            });
            id = (await result.json()).messages.find(
              (m: { Subject: string }) => m.Subject === subject,
            )?.ID;
            return id;
          },
          { timeout: 20_000 },
        )
        .toBeTruthy();
      const email = await (
        await request.get(`${MAILPIT}/api/v1/message/${id}`)
      ).json();
      const code = email.Text.match(/\b[0-9]{5}\b/)?.[0];
      expect(code).toMatch(/^[0-9]{5}$/);
      const codeInput = page.getByLabel(fa ? "کد ۵ رقمی" : "5-digit code", {
        exact: true,
      });
      await expect(codeInput).toBeFocused();
      const slots = page.locator("[data-code-slot]");
      await expect(slots).toHaveCount(5);
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
        // @ts-expect-error axe is injected in the real browser
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
      await page.setViewportSize({ width: 390, height: 844 });
      await codeInput.click({ position: { x: 20, y: 36 } });
      await page.keyboard.type(code === "00000" ? "99999" : "00000");
      const verifyButton = page.getByRole("button", {
        name: fa ? "تأیید کد و ورود" : "Verify code and sign in",
        exact: true,
      });
      await verifyButton.click();
      await expect(page.locator("form [role=alert]")).toContainText(
        fa ? "کد درست نیست" : "The code is incorrect",
      );
      await codeInput.fill(
        fa
          ? [...code].map((digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]).join("")
          : code,
      );
      await verifyButton.click();
      await expect(page).toHaveURL(`${origin}/${locale}/account`);
      const cookie = (await page.context().cookies()).find(
        (c) => c.name === "cv_refresh",
      );
      expect(cookie).toMatchObject({
        httpOnly: true,
        sameSite: "Strict",
        path: "/session",
      });
      const refreshed = await page.request.post(`${origin}/session/refresh`, {
        headers: { origin },
        data: {},
      });
      expect(refreshed.status()).toBe(200);
      const tokens = await refreshed.json();
      expect(tokens).not.toHaveProperty("refresh_token");
      const me = await request.get(`${API}/me`, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      expect((await me.json()).id).toBe(user.id);
      const replay = await request.post(`${API}/auth/email-code/verify`, {
        data: { challenge_id: challenge.challenge_id, code },
      });
      expect(replay.status()).toBe(401);
    }
  }
});
