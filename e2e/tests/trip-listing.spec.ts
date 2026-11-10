import { expect, test } from "@playwright/test";
import { API, PASSWORD, WEB, auth, createListing, day, register, reserve } from "./helpers";

/** A guest sees the booked place again from their trip (feature 022): its photos and a link to its listing. */
test.use({ extraHTTPHeaders: {} });

test("a trip shows the place's photos and links back to its listing", async ({ page, request }) => {
  const host = await register(request, "triphost");
  const guest = await register(request, "tripguest");
  const listing = await createListing(request, host, { title: "E2E trip place" });
  const booking = await (await reserve(request, guest, listing.id, day(20), day(22))).json();
  expect((await request.post(`${API}/bookings/${booking.id}/pay`, { headers: auth(guest) })).status()).toBe(200);

  const login = await page.request.post(`${WEB}/session/login`, {
    headers: { origin: WEB },
    data: { email: guest.email, password: PASSWORD },
  });
  expect(login.status()).toBe(200);

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${WEB}/fa/trips`);
  await expect(page.getByRole("link", { name: "مشاهده‌ی آگهی" }).first()).toBeVisible();

  await page.goto(`${WEB}/fa/trips/${booking.id}`);
  const place = page.getByRole("region", { name: "اقامتگاه این سفر" });
  await expect(place.getByRole("button", { name: "نمایش همه‌ی عکس‌ها" })).toBeVisible();
  await place.getByRole("link", { name: "مشاهده‌ی آگهی" }).click();
  await page.waitForURL(new RegExp(`/fa/listings/${listing.id}`));
  await expect(page.getByRole("heading", { level: 1, name: "E2E trip place" })).toBeVisible();
});
