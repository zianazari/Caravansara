import { expect, test } from "@playwright/test";
import { API, PASSWORD, WEB, auth, createListing, day, register, reserve } from "./helpers";

/**
 * Paying opens a success page with a printable receipt (feature 047), in a real Chrome on the running stack:
 * the guest holds dates, pays from the trip page, lands on the receipt, and in print only the receipt shows.
 */
test.use({ extraHTTPHeaders: {} });

test("paying shows the success page and a receipt that prints on its own", async ({ page, request }) => {
  const host = await register(request, "receipthost");
  const guest = await register(request, "receiptguest");
  const listing = await createListing(request, host, { title: "E2E receipt place" });
  const booking = await (await reserve(request, guest, listing.id, day(40), day(43))).json();
  const login = await page.request.post(`${WEB}/session/login`, {
    headers: { origin: WEB },
    data: { email: guest.email, password: PASSWORD },
  });
  expect(login.status()).toBe(200);

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${WEB}/fa/trips/${booking.id}`);
  await page.getByRole("button", { name: /^پرداخت/ }).click();
  await page.waitForURL(new RegExp(`/fa/trips/${booking.id}/receipt$`));
  await expect(page.getByRole("heading", { name: "پرداخت با موفقیت انجام شد" })).toBeVisible();
  const receipt = page.getByRole("article", { name: "رسید پرداخت" });
  await expect(receipt).toContainText(`CRV-${String(booking.id).padStart(6, "0")}`);
  await expect(receipt).toContainText("E2E receipt place");
  await expect(page.getByRole("button", { name: "چاپ رسید" })).toBeVisible();
  const paid = await (await request.get(`${API}/bookings/${booking.id}`, { headers: auth(guest) })).json();
  expect(paid.paid_at).not.toBeNull();
  if (process.env.SCREENSHOTS) await page.screenshot({ path: "test-results/receipt-screen.png", fullPage: true });

  // In print, the header, footer, bottom bar, success banner and buttons go; the receipt stays.
  await page.emulateMedia({ media: "print" });
  await expect(page.locator("header").first()).toBeHidden();
  await expect(page.getByRole("button", { name: "چاپ رسید" })).toBeHidden();
  await expect(receipt).toBeVisible();
  await expect(page.locator("[data-sonner-toaster]")).toBeHidden(); // the "paid" toast stays off paper
  if (process.env.SCREENSHOTS) await page.screenshot({ path: "test-results/receipt-print.png", fullPage: true });
});
