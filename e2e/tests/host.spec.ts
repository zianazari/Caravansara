import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import {
  API,
  PASSWORD,
  WEB,
  approve,
  findInSearch,
  register,
  reserve,
  samplePhoto,
  testAdmin,
  day,
  type User,
} from "./helpers";

/**
 * The host pages in a real Chrome on the running stack (specs/008-host-pages): a new user makes a listing
 * through the eight steps, with three photos, and then keeps it: price without review, title with the review
 * warning, the cover, the three-photo rule, off and on, a rejection and sending again. The pages themselves are
 * tested with Vitest; this checks the real API, storage and browser together.
 */
test.use({ extraHTTPHeaders: {} });
test.describe.configure({ mode: "serial", timeout: 180_000 });

let host: User & { name: string };
let listingId: number;

/** A new user signed in on the site (the refresh cookie is the site's own, HttpOnly). */
async function signUp(page: Page, name: string) {
  const email = `e2e.${name}.${randomUUID().slice(0, 8)}@caravansara.example.com`;
  const res = await page.request.post(`${WEB}/session/register`, {
    headers: { origin: WEB },
    data: { email, password: PASSWORD, full_name: `E2E ${name}` },
  });
  expect(res.status(), await res.text()).toBe(201);
  const body = await res.json();
  return { id: body.user.id, email, token: body.access_token, refresh: "", name };
}

const photo = (name: string, size?: number) => {
  const base = samplePhoto();
  // Bytes after the JPEG's end marker are ignored by every decoder: a bigger file with the same picture.
  const buffer = size ? Buffer.concat([base, Buffer.alloc(size - base.length)]) : base;
  return { name, mimeType: "image/jpeg", buffer };
};

async function hostGet(page: Page, path: string) {
  const res = await page.request.get(`${WEB}${API}${path}`, { headers: { Authorization: `Bearer ${host.token}` } });
  expect(res.status(), await res.text()).toBe(200);
  return res.json();
}

const next = (page: Page) => page.getByRole("button", { name: "بعدی" }).click();

test("a new user makes a listing in eight steps, with three photos (US1, US2)", async ({ page, request }) => {
  host = await signUp(page, "webhost");
  await page.goto(`${WEB}/fa`);
  await page.getByRole("link", { name: "میزبان شوید" }).click();
  await expect(page.getByText("گام ۱ از ۸")).toBeVisible();

  await page.getByRole("radio", { name: /کل اقامتگاه/ }).check();
  await next(page);

  await page.getByRole("combobox", { name: "شهر" }).fill("Amsterdam");
  await page.getByRole("option", { name: /آمستردام/ }).click();
  await page.getByRole("textbox", { name: "نشانی دقیق" }).fill("Herengracht 10, Amsterdam");
  const map = page.getByTestId("map");
  await expect(map.locator("canvas")).toBeVisible();
  await map.click();
  await expect(page.getByRole("spinbutton", { name: "عرض جغرافیایی" })).not.toHaveValue("");
  await next(page);

  await expect(page.getByText("گام ۳ از ۸")).toBeVisible();
  await next(page); // the usual capacity
  await expect(page.getByText("گام ۴ از ۸")).toBeVisible();
  await page.getByRole("checkbox", { name: "وای‌فای" }).click();
  await next(page);

  const title = `E2E web host ${randomUUID().slice(0, 6)}`;
  await page.getByRole("textbox", { name: "عنوان" }).fill(title);
  await next(page);

  await expect(page.getByRole("combobox", { name: "واحد پول" })).toHaveValue("EUR"); // from the Netherlands
  await page.getByRole("combobox", { name: "واحد پول" }).selectOption("IRR");
  await page.getByRole("textbox", { name: "قیمت هر شب" }).fill("۱۲۰٬۰۰۰");
  await next(page);
  await next(page); // the usual times

  const send = page.getByRole("button", { name: "ارسال برای بازبینی" });
  await page.getByLabel("انتخاب عکس‌ها").setInputFiles([photo("a.jpg"), photo("b.jpg")]);
  await expect(send).toBeDisabled();
  await page.getByLabel("انتخاب عکس‌ها").setInputFiles([photo("c.jpg")]);
  await send.click();

  await page.waitForURL(/\/fa\/host\/listings\/\d+/);
  listingId = Number(/listings\/(\d+)/.exec(page.url())![1]);
  await expect(page.getByText("در انتظار تأیید").first()).toBeVisible();

  const saved = await hostGet(page, `/listings/${listingId}`);
  expect(saved.title).toBe(title);
  expect(saved.price_per_night).toBe("1200000.00"); // toman × 10
  expect(saved.currency).toBe("IRR");
  expect(saved.photos).toHaveLength(3);
  expect(saved.amenities.flatMap((g: { amenities: { name: string }[] }) => g.amenities.map((a) => a.name))).toContain("Wifi");

  const admin = await testAdmin(request);
  const all = [];
  for (let offset = 0; ; offset += 100) {
    const pageOf = await (
      await request.get(`${API}/admin/listings/pending`, { headers: admin, params: { limit: 100, offset } })
    ).json();
    all.push(...pageOf.items);
    if (pageOf.items.length < 100) break;
  }
  expect(all.map((l: { id: number }) => l.id)).toContain(listingId);
  expect(await findInSearch(request, { city_id: 1 }, listingId)).toBeUndefined();
});

test("price needs no review, the title does, and the host is told first (US3, R8)", async ({ page, request }) => {
  await approve(request, listingId);
  await page.request.post(`${WEB}/session/login`, {
    headers: { origin: WEB },
    data: { email: host.email, password: PASSWORD },
  });
  await page.goto(`${WEB}/fa/host/listings/${listingId}`);
  await expect(page.getByText("فعال", { exact: true }).first()).toBeVisible();

  const price = page.getByRole("textbox", { name: "قیمت هر شب" });
  await price.fill("۱۵۰٬۰۰۰");
  await page.getByRole("button", { name: "ذخیره‌ی تغییرها" }).click();
  await expect(page.getByText("تغییرها ذخیره شد.")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect((await hostGet(page, `/listings/${listingId}`)).price_per_night).toBe("1500000.00");

  await page.getByRole("textbox", { name: "عنوان" }).fill("E2E renamed house");
  await page.getByRole("button", { name: "ذخیره‌ی تغییرها" }).click();
  const dialog = page.getByRole("dialog", { name: "این تغییر بازبینی می‌خواهد" });
  await dialog.getByRole("button", { name: "ذخیره و فرستادن برای بازبینی" }).click();
  await expect(page.getByText("در انتظار تأیید").first()).toBeVisible();
  expect((await hostGet(page, `/listings/${listingId}`)).review.status).toBe("pending");
});

test("photos: a new cover shows on the card, removal stops at three, a 5 MB photo arrives in time (US2, SC-005)", async ({
  page,
  request,
}) => {
  await approve(request, listingId);
  await page.request.post(`${WEB}/session/login`, {
    headers: { origin: WEB },
    data: { email: host.email, password: PASSWORD },
  });
  await page.goto(`${WEB}/fa/host/listings/${listingId}?tab=photos`);
  const third = page.getByRole("group", { name: "عکس ۳" });
  await expect(third.getByRole("button", { name: "حذف عکس" })).toBeDisabled();
  const before = await hostGet(page, `/listings/${listingId}`);
  await third.getByRole("button", { name: "کاور کن" }).click();
  await expect
    .poll(async () => (await hostGet(page, "/me/listings?limit=100")).items.find((l: { id: number }) => l.id === listingId).cover_url)
    .toBe(before.photos[2].url);

  const started = Date.now();
  await page.getByLabel("انتخاب عکس‌ها").setInputFiles([photo("big.jpg", 5 * 1024 * 1024)]);
  await page.getByRole("dialog").getByRole("button", { name: "ذخیره و فرستادن برای بازبینی" }).click();
  await expect(page.getByRole("group", { name: "عکس ۴" })).toBeVisible({ timeout: 15_000 });
  const seconds = (Date.now() - started) / 1000;
  console.log(`SC-005: a 5 MB photo from choosing to shown in the listing: ${seconds.toFixed(1)} s`);
  expect(seconds).toBeLessThan(15);
  await expect(page.getByRole("group", { name: "عکس ۱" }).getByRole("button", { name: "حذف عکس" })).toBeEnabled();
});

test("off and on: out of search and back, and the booking stays (US3/AC5, US4)", async ({ page, request }) => {
  await approve(request, listingId);
  const guest = await register(request, "webguest");
  const booking = await reserve(request, guest, listingId, day(50), day(52));
  expect(booking.status(), await booking.text()).toBe(201);

  await page.request.post(`${WEB}/session/login`, {
    headers: { origin: WEB },
    data: { email: host.email, password: PASSWORD },
  });
  await page.goto(`${WEB}/fa/host/listings/${listingId}`);
  const visible = page.getByRole("checkbox", { name: "نمایش در جستجو" });
  await visible.click();
  await expect(page.getByText("آگهی غیرفعال شد.")).toBeVisible();
  expect(await findInSearch(request, { city_id: 1 }, listingId)).toBeUndefined();

  await page.getByRole("tab", { name: "رزروها" }).click();
  await expect(page.getByText("۲ مهمان")).toBeVisible();

  await page.getByRole("tab", { name: "مشخصات" }).click();
  await visible.click();
  await expect(page.getByText("آگهی فعال شد.")).toBeVisible();
  await expect.poll(async () => (await findInSearch(request, { city_id: 1 }, listingId))?.id).toBe(listingId);
});

test("a rejected listing shows the reason and is sent again (US3)", async ({ page, request }) => {
  const admin = await testAdmin(request);
  // A small change sends it back to review, so there is something to reject.
  await page.request.post(`${WEB}/session/login`, {
    headers: { origin: WEB },
    data: { email: host.email, password: PASSWORD },
  });
  const patched = await page.request.patch(`${WEB}${API}/listings/${listingId}`, {
    headers: { Authorization: `Bearer ${host.token}` },
    data: { description: "Changed for the rejection test." },
  });
  expect(patched.status(), await patched.text()).toBe(200);
  const version = (await (await request.get(`${API}/admin/listings/${listingId}`, { headers: admin })).json())
    .review_version;
  const rejected = await request.post(`${API}/admin/listings/${listingId}/reject`, {
    headers: admin,
    data: { review_version: version, reason: "The photos are not of this flat." },
  });
  expect(rejected.status(), await rejected.text()).toBe(200);

  await page.goto(`${WEB}/fa/host`);
  await expect(page.getByText("رد شده").first()).toBeVisible();
  await page.goto(`${WEB}/fa/host/listings/${listingId}`);
  await expect(page.getByText("دلیل رد: The photos are not of this flat.")).toBeVisible();
  await page.getByRole("button", { name: "ارسال دوباره برای بازبینی" }).click();
  await expect(page.getByText("در انتظار تأیید").first()).toBeVisible();
});

test("another user's listing is not found (R12)", async ({ page }) => {
  await signUp(page, "stranger");
  await page.goto(`${WEB}/fa/host/listings/${listingId}`);
  await expect(page.getByText("این صفحه پیدا نشد")).toBeVisible();
  await expect(page.getByRole("tablist")).toHaveCount(0);
});
