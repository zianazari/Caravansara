import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { API, PASSWORD, WEB, createListing } from "./helpers";

/**
 * AVIF listing photos on the running stack (feature 023): a real AVIF file (made from postman/sample-photo.jpg
 * with macOS sips) is checked in the browser, measured, sent straight to storage and registered.
 */
test.use({ extraHTTPHeaders: {} });

test("a host adds an AVIF photo to a listing", async ({ page, request }) => {
  const email = `e2e.avif.${randomUUID().slice(0, 8)}@caravansara.example.com`;
  const res = await page.request.post(`${WEB}/session/register`, {
    headers: { origin: WEB },
    data: { email, password: PASSWORD, full_name: "E2E avif host" },
  });
  expect(res.status()).toBe(201);
  const token = (await res.json()).access_token as string;
  const host = { id: 0, email, token, refresh: "" };
  const listing = await createListing(request, host, { title: "E2E avif flat" }, { approved: false });

  await page.goto(`${WEB}/fa/host/listings/${listing.id}?tab=photos`);
  const avif = readFileSync(path.join(__dirname, "..", "fixtures", "sample-photo.avif"));
  await page.getByLabel("انتخاب عکس‌ها").setInputFiles([{ name: "room.avif", mimeType: "image/avif", buffer: avif }]);
  await expect(page.getByRole("group", { name: "عکس ۱" })).toBeVisible({ timeout: 15_000 });

  const saved = await (await request.get(`${API}/listings/${listing.id}`, { headers: { Authorization: `Bearer ${token}` } })).json();
  expect(saved.photos).toHaveLength(1);
  expect(saved.photos[0].url).toMatch(/\.avif$/);
  expect(saved.photos[0].width).toBeGreaterThan(1); // measured in the browser from the real file
});
