import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { API, PASSWORD, WEB, auth, createListing, expectError, register } from "./helpers";

/**
 * Wishlists on the running stack (feature 012): the API's rules, and the heart in a real Chrome, from a
 * search card to the wishlist page and the bottom bar on a phone.
 */
test.describe("Wishlist API", () => {
  test("saves, lists newest first, removes, and refuses a listing that is not public", async ({ request }) => {
    const host = await register(request, "wishhost");
    const guest = await register(request, "wishguest");
    const first = await createListing(request, host, { title: "E2E saved first" });
    const second = await createListing(request, host, { title: "E2E saved second" });
    for (const l of [first, second]) {
      expect((await request.put(`${API}/me/wishlist/${l.id}`, { headers: auth(guest) })).status()).toBe(204);
    }
    const page = await (await request.get(`${API}/me/wishlist`, { headers: auth(guest) })).json();
    expect(page.items.map((i: { listing_id: number }) => i.listing_id)).toEqual([second.id, first.id]);
    expect(page.items[0].listing.cover_url).toBeTruthy();

    const waiting = await createListing(request, host, {}, { approved: false });
    await expectError(await request.put(`${API}/me/wishlist/${waiting.id}`, { headers: auth(guest) }), 404);
    await expectError(await request.get(`${API}/me/wishlist`), 401);

    await request.patch(`${API}/listings/${first.id}`, { headers: auth(host), data: { is_active: false } });
    const after = await (await request.get(`${API}/me/wishlist`, { headers: auth(guest) })).json();
    expect(after.items[1]).toMatchObject({ listing_id: first.id, available: false, listing: null });

    expect((await request.delete(`${API}/me/wishlist/${second.id}`, { headers: auth(guest) })).status()).toBe(204);
    const ids = await (await request.get(`${API}/me/wishlist/ids`, { headers: auth(guest) })).json();
    expect(ids).toEqual({ listing_ids: [first.id] });
  });
});

test.describe("Wishlist in the browser", () => {
  test.use({ extraHTTPHeaders: {} });

  test("a heart on the listing page saves it, and the wishlist page shows it", async ({ page, request }) => {
    const host = await register(request, "wishwebhost");
    const listing = await createListing(request, host, { title: `E2E heart ${randomUUID().slice(0, 6)}` });
    const email = `e2e.wishweb.${randomUUID().slice(0, 8)}@caravansara.example.com`;
    const res = await page.request.post(`${WEB}/session/register`, {
      headers: { origin: WEB },
      data: { email, password: PASSWORD, full_name: "E2E wish web" },
    });
    expect(res.status()).toBe(201);

    await page.goto(`${WEB}/fa/listings/${listing.id}`);
    const heart = page.getByRole("button", { name: `ذخیره در علاقه‌مندی‌ها: ${listing.title}` });
    await heart.click();
    await expect(page.getByRole("button", { name: `برداشتن از علاقه‌مندی‌ها: ${listing.title}` })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${WEB}/fa`);
    await page.getByRole("navigation", { name: "ناوبری پایین" }).getByRole("link", { name: "علاقه‌مندی‌ها" }).click();
    await page.waitForURL(/\/fa\/wishlists/);
    await expect(page.getByText(listing.title)).toBeVisible();
    const [scroll, client] = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.clientWidth,
    ]);
    expect(scroll).toBeLessThanOrEqual(client);
  });

  test("a visitor who taps a heart is sent to log in and back", async ({ page, request }) => {
    const host = await register(request, "wishvisitorhost");
    const listing = await createListing(request, host, { title: "E2E visitor heart" });
    await page.goto(`${WEB}/fa/listings/${listing.id}`);
    await page.getByRole("button", { name: /ذخیره در علاقه‌مندی‌ها/ }).click();
    await page.waitForURL(/\/fa\/login\?returnTo=/);
    expect(decodeURIComponent(page.url())).toContain(`/listings/${listing.id}`);
  });
});
