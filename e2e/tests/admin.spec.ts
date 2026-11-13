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
  reserve,
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
  for (const caption of ["Yard", "Room", "Kitchen", "Bath", "Hall"]) await addPhoto(request, host, listing.id, caption, { approved: false });
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

test("the queue defaults to newest and sorts each field in both directions", async ({ page, request }) => {
  const old = await pendingListing(request, "E2E queue oldest");
  const recent = await pendingListing(request, "E2E queue newest");
  await sql("UPDATE listings SET submitted_at = '2000-01-01' WHERE id = $1", [old.id]);
  await sql("UPDATE listings SET submitted_at = '2099-01-01' WHERE id = $1", [recent.id]);
  await logIn(page);
  const firstTitle = page.locator("main article h2").first();
  await expect(firstTitle).toHaveText("E2E queue newest");
  await expect(page.getByRole("button", { name: "جدیدترین: مرتب‌سازی زمان ارسال به صورت صعودی" })).toHaveText("جدیدترین");
  await page.getByRole("button", { name: "جدیدترین: مرتب‌سازی زمان ارسال به صورت صعودی" }).click();
  await expect(page).toHaveURL(/sort_by=submitted_at&order=asc$/);
  await expect(firstTitle).toHaveText("E2E queue oldest");
  await page.reload();
  await expect(firstTitle).toHaveText("E2E queue oldest");

  await page.goto(`${ADMIN_WEB}/en/admin`);
  for (const [column, label] of [["title", "Listing title"], ["city", "City"], ["host", "Host name"]]) {
    await page.getByRole("combobox", { name: "Order" }).click();
    await page.getByRole("option", { name: label, exact: true }).click();
    for (const order of ["asc", "desc"]) {
      await expect(page).toHaveURL(new RegExp(`sort_by=${column}&order=${order}$`));
      const response = await page.evaluate(async (url) => {
        const res = await fetch(url);
        return { status: res.status, body: await res.json() };
      }, `/admin-api/api/v1/admin/listings/pending?sort_by=${column}&order=${order}&limit=20`);
      expect(response.status).toBe(200);
      await expect(firstTitle).toHaveText(response.body.items[0].title);
      if (order === "asc") await page.getByRole("button", { name: `Ascending: Sort ${label} descending` }).click();
    }
  }
  await page.goto(`${ADMIN_WEB}/en/admin?sort=oldest`);
  await expect(firstTitle).toHaveText("E2E queue oldest");
  expect(recent.id).toBeGreaterThan(0);
});

test("the panel's pages have no sideways scroll and no axe violation, in both languages", async ({ page, request }) => {
  const listing = await pendingListing(request, "E2E panel look");
  await logIn(page);
  for (const locale of ["fa", "en"]) {
    for (const p of ["/admin/login", "/admin", "/admin?tab=bookings", "/admin?tab=users", `/admin/listings/${listing.id}`]) {
      await page.goto(`${ADMIN_WEB}/${locale}${p}`);
      await page.waitForLoadState("networkidle");
      await expect(page.locator("html")).toHaveAttribute("data-design", "cinematic");
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
      if (process.env.ADMIN_SHOTS && p === "/admin?tab=bookings") {
        await page.screenshot({ path: `/private/tmp/admin-theme-${locale}-bookings.png` });
      }
    }
  }
});

test("the panel's tabs list bookings by status and find a user by part of the name (051)", async ({ page, request }) => {
  const listing = await createListing(request, host, { title: "E2E panel booked" });
  const guest = await register(request, "panelguest");
  const hold = await reserve(request, guest, listing.id);
  expect(hold.status()).toBe(201);
  const booking = await hold.json();
  await logIn(page);

  await page.getByRole("tab", { name: /رزروها/ }).click();
  await expect(page).toHaveURL(/\/fa\/admin\?tab=bookings$/);
  await page.getByRole("navigation", { name: "وضعیت رزرو" }).getByRole("link", { name: /پرداخت‌نشده/ }).click();
  await expect(page).toHaveURL(/status=pending/);
  const row = page.getByRole("row").filter({ hasText: "E2E panel booked" }).first();
  await expect(row).toBeVisible();
  await expect(row).toContainText(guest.email);
  await expect(row).toContainText("پرداخت‌نشده");
  expect(booking.status).toBe("pending");

  await page.getByRole("tab", { name: /کاربران/ }).click();
  const box = page.getByLabel("جستجوی نام یا ایمیل");
  await box.fill(guest.email.split("@")[0]);
  await expect(page).toHaveURL(/tab=users&q=/);
  await expect(page.getByRole("row").filter({ hasText: guest.email })).toHaveCount(1);
  await page.reload(); // the tab and the search are kept in the address
  await expect(page.getByRole("tab", { name: /کاربران/, selected: true })).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: guest.email })).toHaveCount(1);
});

test("every table column toggles global sorting and keeps filters and pages", async ({ page, request }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const listing = await createListing(request, host, { title: "E2E sorting table" });
  const guest = await register(request, "sortguest");
  expect((await reserve(request, guest, listing.id)).status()).toBe(201);
  await logIn(page);
  for (const [tab, columns] of [
    ["bookings", ["id", "listing", "guest", "dates", "total_price", "status", "created_at"]],
    ["users", ["full_name", "email", "kind", "created_at"]],
  ] as const) {
    await page.goto(`${ADMIN_WEB}/en/admin?tab=${tab}`);
    await expect(page.getByRole("columnheader")).toHaveCount(columns.length);
    for (let i = 0; i < columns.length; i++) {
      const heading = page.getByRole("columnheader").nth(i);
      for (const order of ["asc", "desc"]) {
        await heading.getByRole("link").click();
        await expect(page).toHaveURL(new RegExp(`sort_by=${columns[i]}&order=${order}$`));
        await expect(heading).toHaveAttribute("aria-sort", order === "asc" ? "ascending" : "descending");
        // Cached sorts need no new UI request; compare the rendered first row with the real API.
        const response = await page.evaluate(async (url) => {
          const res = await fetch(url);
          return { status: res.status, body: await res.json() };
        }, `/admin-api/api/v1/admin/${tab}?sort_by=${columns[i]}&order=${order}&limit=20&offset=0`);
        expect(response.status).toBe(200);
        const first = response.body.items[0];
        expect(first).toBeTruthy();
        const row = page.locator("tbody tr").first();
        if (tab === "bookings") {
          await expect(row.locator("td").first()).toHaveText(String(first.id));
        } else {
          await expect(row.locator("td").nth(1)).toHaveText(first.email);
        }
      }
    }
  }
  await page.goto(`${ADMIN_WEB}/fa/admin?tab=users&sort_by=email&order=asc&page=2`);
  await expect(page.getByRole("columnheader").nth(1)).toHaveAttribute("aria-sort", "ascending");
  const next = page.getByRole("link", { name: "صفحه‌ی ۳", exact: true });
  await expect(next).toHaveAttribute("href", /sort_by=email&order=asc&page=3/);
  await page.getByRole("searchbox").fill(guest.email.split("@")[0]);
  await expect(page).toHaveURL(/q=.*sort_by=email&order=asc$/);
  await expect(page.getByRole("row").filter({ hasText: guest.email })).toHaveCount(1);
  await page.getByRole("columnheader").nth(1).getByRole("link").click();
  await expect(page).toHaveURL(/q=.*sort_by=email&order=desc$/);
});

test("an expired admin token is renewed with the refresh cookie, without a new log-in (011)", async ({ page }) => {
  await logIn(page);
  const refresh = (await page.context().cookies()).find((c) => c.name === "cv_admin_refresh")!;
  expect(refresh).toMatchObject({ httpOnly: true, sameSite: "Strict", path: "/admin-api" });
  expect(refresh.expires * 1000 - Date.now()).toBeGreaterThan(7.9 * 3600 * 1000);
  // As if 15 minutes had passed: the browser drops the short cookie when the token ends.
  await page.context().clearCookies({ name: "cv_admin" });
  await page.reload();
  await expect(page.getByRole("heading", { name: "صف بازبینی" })).toBeVisible();
  const renewed = (await page.context().cookies()).find((c) => c.name === "cv_admin_refresh")!;
  expect(renewed.value).not.toBe(refresh.value);
  expect((await page.context().cookies()).some((c) => c.name === "cv_admin")).toBe(true);
});

test("logging out ends the session", async ({ page }) => {
  await logIn(page);
  await page.getByRole("button", { name: "خروج" }).click();
  await page.waitForURL(/\/fa\/admin\/login/);
  expect((await page.context().cookies()).find((c) => c.name === "cv_admin")).toBeUndefined();
  expect((await page.context().cookies()).find((c) => c.name === "cv_admin_refresh")).toBeUndefined();
});

test("shows a house marker on the listing review map", async ({
  page,
  request,
}) => {
  const listing = await createListing(
    request,
    host,
    { title: "E2E admin house marker" },
    { approved: false },
  );
  await logIn(page);
  await page.goto(`${ADMIN_WEB}/fa/admin/listings/${listing.id}`);
  await expect(page.locator('[data-map-marker="house"] svg')).toBeVisible();
});
