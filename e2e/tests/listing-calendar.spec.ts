import { expect, test } from "@playwright/test";
import { API, WEB, auth, createListing, day, register, reserve } from "./helpers";

/**
 * The listing's calendar on the running stack (feature 019): a paid stay's nights show as taken, a stay cannot
 * cross them, and the dates chosen in the calendar reach the booking box.
 */
test.use({ extraHTTPHeaders: {} });

test("a paid stay's nights are struck through, and the calendar fills the booking box", async ({ page, request }) => {
  const host = await register(request, "calhost");
  const guest = await register(request, "calguest");
  const listing = await createListing(request, host, { title: "E2E calendar flat" });
  const booking = await (await reserve(request, guest, listing.id, day(5), day(7))).json();
  expect((await request.post(`${API}/bookings/${booking.id}/pay`, { headers: auth(guest) })).status()).toBe(200);

  const availability = await (await request.get(`${API}/listings/${listing.id}/availability`)).json();
  expect(availability.booked_nights).toEqual([day(5), day(6)]);

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${WEB}/en/listings/${listing.id}`);
  const calendar = page.locator("section[aria-labelledby='calendar-title']");
  await expect(calendar.locator(`[data-date="${day(5)}"]`)).toBeDisabled();
  await expect(calendar.locator(`[data-date="${day(5)}"]`)).toHaveClass(/line-through/);

  await calendar.locator(`[data-date="${day(2)}"]`).click();
  await calendar.locator(`[data-date="${day(5)}"]`).click(); // leave the morning the paid stay starts
  await expect(calendar.getByRole("heading", { level: 2 })).toHaveText(/3 nights in/);
  await expect(page.getByRole("complementary").getByRole("button", { name: /Dates/ })).not.toContainText("Any dates");
});
