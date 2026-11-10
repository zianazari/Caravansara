import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
import {
  API,
  WEB,
  addPhoto,
  auth,
  createAdmin,
  createListing,
  register,
  sql,
  type User,
} from "./helpers";

/**
 * The admin panel in a real Chrome on the running stack (feature 009). It answers only on its own host
 * (`ADMIN_HOST`, `admin.localhost:3001` in compose); the public host has no trace of it. The admin logs in, opens
 * a listing from the queue, sees the exact address (each view recorded), approves, rejects with a reason, and a
 * host's change in the meantime is caught (409) instead of approved unseen.
 */
test.use({ extraHTTPHeaders: {} });
test.describe.configure({ mode: "serial", timeout: 120_000 });

const ADMIN_WEB = process.env.ADMIN_WEB_URL ?? "http://admin.localhost:3001";
const AXE = path.join(__dirname, "..", "node_modules", "axe-core", "axe.min.js");
let admin: { email: string; password: string };
let host: User;

async function pendingListing(request: Parameters<typeof createListing>[0], title: string) {
  const listing = await createListing(request, host, { title }, { approved: false });
  for (const caption of ["Yard", "Room", "Kitchen"]) await addPhoto(request, host, listing.id, caption, { approved: false });
  return listing;
}

async function logIn(page: Page) {
  await page.goto(`${ADMIN_WEB}/`);
  await page.waitForURL(/\/fa\/admin\/login/);
  await page.getByLabel("ایمیل").fill(admin.email);
  await page.getByLabel("رمز").fill(admin.password);
  await page.getByRole("button", { name: "ورود" }).click();
  await expect(page.getByRole("heading", { name: "صف بازبینی" })).toBeVisible();
}

async function reviewOf(request: Parameters<typeof createListing>[0], id: number) {
  const res = await request.get(`${API}/listings/${id}`, { headers: auth(host) });
  expect(res.status()).toBe(200);
  return (await res.json()).review;
}

test.beforeAll(async ({ request }) => {
  admin = createAdmin("panel");
  host = await register(request, "panelhost");
});

test("the public host has no admin panel, and the admin host has nothing else", async ({ request }) => {
  for (const p of ["/fa/admin", "/en/admin/login", "/admin-api/login"]) {
    expect((await request.get(`${WEB}${p}`, { maxRedirects: 0 })).status(), p).toBe(404);
  }
  for (const p of ["/fa/search", "/fa/host", "/api/v1/countries"]) {
    expect((await request.get(`${ADMIN_WEB}${p}`, { maxRedirects: 0 })).status(), p).toBe(404);
  }
  const home = await request.get(`${WEB}/fa`);
  expect(await home.text()).not.toContain("admin.localhost");
});

test("logs in, keeps the token out of page scripts, and approves a listing", async ({ page, request }) => {
  const listing = await pendingListing(request, "E2E panel courtyard");
  await logIn(page);
  const cookie = (await page.context().cookies()).find((c) => c.name === "cv_admin")!;
  expect(cookie).toMatchObject({ httpOnly: true, sameSite: "Strict", path: "/admin-api" });
  expect(await page.evaluate(() => document.cookie)).not.toContain("cv_admin");

  await page.goto(`${ADMIN_WEB}/fa/admin/listings/${listing.id}`);
  await expect(page.getByRole("heading", { name: "E2E panel courtyard" })).toBeVisible();
  await expect(page.getByText("Herengracht 1, Amsterdam")).toBeVisible();
  await expect(page.getByRole("img", { name: "Kitchen" })).toBeVisible();
  const views = await sql("SELECT count(*)::int AS n FROM admin_address_views WHERE listing_id = $1", [listing.id]);
  expect(views[0].n).toBeGreaterThanOrEqual(1);

  await page.getByRole("button", { name: "تأیید و انتشار" }).click();
  await page.waitForURL(/\/fa\/admin$/);
  await expect(page.getByText("آگهی تأیید و منتشر شد.")).toBeVisible();
  expect((await reviewOf(request, listing.id)).status).toBe("approved");
});

test("rejects with a reason the host sees as written", async ({ page, request }) => {
  const listing = await pendingListing(request, "E2E panel reject");
  await logIn(page);
  await page.goto(`${ADMIN_WEB}/en/admin/listings/${listing.id}`);
  await page.getByRole("button", { name: "Reject" }).click();
  const dialog = page.getByRole("dialog", { name: "Reject this listing" });
  await dialog.getByRole("button", { name: "Reject and send the reason" }).click();
  await expect(dialog.getByRole("alert")).toHaveText("Write the reason.");
  await dialog.getByRole("textbox").fill("The photos are not of this flat.");
  await dialog.getByRole("button", { name: "Reject and send the reason" }).click();
  await page.waitForURL(/\/en\/admin$/);
  expect(await reviewOf(request, listing.id)).toMatchObject({
    status: "rejected",
    rejection_reason: "The photos are not of this flat.",
  });
});

test("a host's change while the admin looks is caught, not approved unseen (409)", async ({ page, request }) => {
  const listing = await pendingListing(request, "E2E panel race");
  await logIn(page);
  await page.goto(`${ADMIN_WEB}/fa/admin/listings/${listing.id}`);
  await expect(page.getByRole("heading", { name: "E2E panel race" })).toBeVisible();
  const patched = await request.patch(`${API}/listings/${listing.id}`, {
    headers: auth(host),
    data: { title: "E2E panel race, renamed" },
  });
  expect(patched.status(), await patched.text()).toBe(200);

  await page.getByRole("button", { name: "تأیید و انتشار" }).click();
  await expect(page.getByText(/میزبان همین حالا آگهی را تغییر داد/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "E2E panel race, renamed" })).toBeVisible();
  expect((await reviewOf(request, listing.id)).status).toBe("pending");
  await page.getByRole("button", { name: "تأیید و انتشار" }).click();
  await page.waitForURL(/\/fa\/admin$/);
  expect((await reviewOf(request, listing.id)).status).toBe("approved");
});

test("the panel's pages have no sideways scroll and no axe violation, in both languages", async ({ page, request }) => {
  const listing = await pendingListing(request, "E2E panel look");
  await logIn(page);
  for (const locale of ["fa", "en"]) {
    for (const p of ["/admin/login", "/admin", `/admin/listings/${listing.id}`]) {
      await page.goto(`${ADMIN_WEB}/${locale}${p}`);
      await page.waitForLoadState("networkidle");
      for (const width of [320, 390, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        await page.waitForTimeout(100);
        const [scroll, client] = await page.evaluate(() => [
          document.documentElement.scrollWidth,
          document.documentElement.clientWidth,
        ]);
        expect(scroll, `${locale}${p} at ${width}px`).toBeLessThanOrEqual(client);
      }
      await page.addScriptTag({ path: AXE });
      const violations = await page.evaluate(async () => {
        // @ts-expect-error axe is injected above
        const result = await window.axe.run(document, {
          runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] },
        });
        return result.violations.map(
          (v: { id: string; nodes: { target: string[] }[] }) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
        );
      });
      expect(violations, `${locale}${p}`).toEqual([]);
    }
  }
});

test("logging out ends the session", async ({ page }) => {
  await logIn(page);
  await page.getByRole("button", { name: "خروج" }).click();
  await page.waitForURL(/\/fa\/admin\/login/);
  expect((await page.context().cookies()).find((c) => c.name === "cv_admin")).toBeUndefined();
});
