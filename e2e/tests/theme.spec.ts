import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import path from "node:path";
import {
  API,
  PASSWORD,
  WEB,
  addPhoto,
  auth,
  createListing,
  day,
  register,
  reserve,
  sql,
  type User,
} from "./helpers";

/**
 * The caravansara theme in a real Chrome on the running stack (specs/007-caravansara-theme, T041): every guest
 * page at five widths and in both languages has no sideways scroll (SC-004) and no accessibility violation,
 * contrast included, which jsdom cannot measure (SC-002). Also reduced motion, a dark system theme, print, the
 * hero's contrast and a swipe through the gallery. `--grep screenshots` writes the pictures the owner compares
 * with mockup/ (SC-001).
 */
// Pages are opened by their full address on the site; the API helpers keep the API as their base.
test.use({ extraHTTPHeaders: {} });

const AXE = path.join(__dirname, "..", "node_modules", "axe-core", "axe.min.js");
const SCREENS = path.join(__dirname, "..", "..", "specs", "007-caravansara-theme", "screens");
const WIDTHS = [320, 360, 390, 768, 1280];

type World = { guest: User; host: User; listingId: number; tripId: number; reviewId: number };
let world: World;

test.beforeAll(async ({ request }) => {
  const host = await register(request, "themehost");
  const guest = await register(request, "themeguest");
  const listing = await createListing(request, host, { title: "E2E theme courtyard house" });
  await addPhoto(request, host, listing.id);
  await addPhoto(request, host, listing.id, "Bedroom");
  const trip = await (await reserve(request, guest, listing.id, day(60), day(63))).json();
  // A finished stay for the review form: paid, then moved into the past, as the review tests do.
  const stay = await (await reserve(request, guest, listing.id, day(70), day(72))).json();
  expect((await request.post(`${API}/bookings/${stay.id}/pay`, { headers: auth(guest) })).status()).toBe(200);
  await sql(
    "UPDATE bookings SET check_in = CURRENT_DATE - 3, check_out = CURRENT_DATE - 1, status = 'completed' WHERE id = $1",
    [stay.id],
  );
  world = { guest, host, listingId: listing.id, tripId: trip.id, reviewId: stay.id };
});

/** A session in the browser, through the site's own login (the refresh cookie is HttpOnly). */
async function signIn(page: Page, who: User = world.guest) {
  const res = await page.request.post(`${WEB}/session/login`, {
    headers: { origin: WEB },
    data: { email: who.email, password: PASSWORD },
  });
  expect(res.status(), await res.text()).toBe(200);
}

type PageCase = { name: string; path: () => string; signedIn?: boolean; asHost?: boolean; draft?: boolean };
const PAGES: PageCase[] = [
  { name: "home", path: () => "/" },
  { name: "search", path: () => `/search?city_id=1&check_in=${day(60)}&check_out=${day(63)}&adults=2` },
  { name: "listing", path: () => `/listings/${world.listingId}` },
  { name: "login", path: () => "/login" },
  { name: "register", path: () => "/register" },
  { name: "book", path: () => `/book/${world.listingId}`, signedIn: true, draft: true },
  { name: "trips", path: () => "/trips", signedIn: true },
  { name: "trip", path: () => `/trips/${world.tripId}`, signedIn: true },
  { name: "review", path: () => `/trips/${world.reviewId}/review`, signedIn: true },
  { name: "account", path: () => "/account", signedIn: true },
  { name: "wishlists", path: () => "/wishlists", signedIn: true }, // feature 012
  { name: "not-found", path: () => "/no-such-page" },
  // The host pages (specs/008-host-pages, SC-004), as the listing's host.
  { name: "host", path: () => "/host", signedIn: true, asHost: true },
  { name: "host-new", path: () => "/host/new?step=1", signedIn: true, asHost: true },
  { name: "host-photos", path: () => `/host/listings/${world.listingId}?tab=photos`, signedIn: true, asHost: true },
];

async function open(page: Page, locale: "fa" | "en", c: PageCase) {
  if (c.signedIn) await signIn(page, c.asHost ? world.host : world.guest);
  if (c.draft) {
    const draft = {
      listing_id: world.listingId,
      check_in: day(80),
      check_out: day(82),
      adults: 2,
      children: 0,
      infants: 0,
      pets: 0,
      idempotency_key: randomUUID(),
    };
    await page.addInitScript((d) => sessionStorage.setItem("cv-booking-draft", JSON.stringify(d)), draft);
  }
  await page.goto(`${WEB}/${locale}${c.path()}`);
  await page.waitForLoadState("networkidle");
  // The home page's city rows load as they come into view; scroll once so the whole page is there.
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 500) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForLoadState("networkidle");
}

async function axe(page: Page) {
  await page.addScriptTag({ path: AXE });
  return page.evaluate(async () => {
    // @ts-expect-error axe is injected above
    const result = await window.axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] },
    });
    const list = (items: { id: string; nodes: { target: string[] }[] }[]) =>
      items.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
    return { violations: list(result.violations), incomplete: list(result.incomplete) };
  });
}

test.describe("Caravansara theme in a real browser", () => {
  test.describe.configure({ timeout: 120_000 });

  for (const c of PAGES) {
    for (const locale of ["fa", "en"] as const) {
      test(`${c.name} (${locale}): no sideways scroll at any width, and no axe violation (SC-002, SC-004)`, async ({
        page,
      }) => {
        await open(page, locale, c);
        for (const width of WIDTHS) {
          await page.setViewportSize({ width, height: 900 });
          await page.waitForTimeout(100);
          const [scroll, client] = await page.evaluate(() => [
            document.documentElement.scrollWidth,
            document.documentElement.clientWidth,
          ]);
          expect(scroll, `${c.name} at ${width}px`).toBeLessThanOrEqual(client);
        }
        await page.setViewportSize({ width: 390, height: 900 });
        expect((await axe(page)).violations, `${c.name} on a phone`).toEqual([]);
        await page.setViewportSize({ width: 1280, height: 900 });
        expect((await axe(page)).violations, `${c.name} on a desktop`).toEqual([]);
      });
    }
  }

  test("the listing page has the booking bar, not the bottom bar, on a phone (R7)", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, "fa", PAGES[2]!);
    await expect(page.getByRole("navigation", { name: "ناوبری پایین" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "رزرو" })).toBeVisible();
    await page.goto(`${WEB}/fa`);
    await expect(page.getByRole("navigation", { name: "ناوبری پایین" })).toBeVisible();
  });

  test("a swipe moves the gallery on a phone (FR-007)", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    const page = await context.newPage();
    await page.goto(`${WEB}/fa/listings/${world.listingId}`);
    const current = page.getByRole("button", { name: /^عکس ۱ از/ });
    await expect(current).toHaveAttribute("aria-current", "true");
    const figure = page.locator("figure").first();
    const box = (await figure.boundingBox())!;
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + 60, y);
    await page.mouse.down();
    await page.mouse.move(box.x + 200, y, { steps: 5 });
    await page.mouse.up();
    await expect(page.getByRole("button", { name: /^عکس ۲ از/ })).toHaveAttribute("aria-current", "true");
    await context.close();
  });

  test("decoration stops for reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`${WEB}/fa`);
    const running = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running").length);
    expect(running).toBe(0);
  });

  test("a dark system theme keeps the light site and its form controls (edge case)", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    for (const c of [PAGES[0]!, PAGES[1]!, PAGES[3]!]) {
      await open(page, "fa", c);
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe("light");
      expect((await axe(page)).violations, c.name).toEqual([]);
    }
  });

  test("printing a trip has no dark surfaces (edge case)", async ({ page }) => {
    await open(page, "fa", PAGES[7]!);
    await page.emulateMedia({ media: "print" });
    const footer = await page.locator("footer").evaluate((el) => getComputedStyle(el).display);
    expect(footer).toBe("none");
  });

  test("the hero is a short strip with no visible text, always at the top while the page scrolls (041)", async ({ page }) => {
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${WEB}/fa`, { waitUntil: "networkidle" });
      const hero = page.locator("section[aria-labelledby='hero-title']");
      // The page keeps its main heading for screen readers only; nothing in the strip is visible text.
      await expect(page.getByRole("heading", { level: 1 })).toHaveClass(/sr-only/);
      expect(await hero.locator("svg text").count()).toBe(0);
      expect((await hero.boundingBox())!.height, `strip height at ${width}px`).toBeLessThanOrEqual(180);
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight / 2));
      const scrolled = (await hero.boundingBox())!;
      expect(scrolled.y, `strip stays under the header at ${width}px`).toBeGreaterThanOrEqual(0);
      expect(scrolled.y, `strip stays under the header at ${width}px`).toBeLessThan(80);
    }
  });

  test("the hero's car stops at six places as the whole page scrolls, and drives back (041)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${WEB}/fa`, { waitUntil: "networkidle" });
    const scene = page.locator("svg[data-hero='scene']");
    await expect(scene.locator("[data-stop]")).toHaveCount(6);
    // The trip follows the scroll of the whole page; let the rows load so the page has its full length.
    await page.waitForTimeout(1500);
    const room = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
    for (const [index, kind] of [[2, "caravansara"], [5, "ecolodge"]] as const) {
      await page.evaluate((y) => window.scrollTo(0, y), ((index + 0.75) / 6) * room);
      await expect.poll(() => scene.locator(`[data-stop='${kind}']`).getAttribute("data-active")).toBe("true");
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect.poll(() => scene.locator("[data-active='true']").count()).toBe(0);
  });

  test("screenshots for the owner (SC-001)", async ({ page }) => {
    test.skip(!process.env.SCREENSHOTS, "set SCREENSHOTS=1 to write specs/007-caravansara-theme/screens/");
    for (const c of PAGES) {
      for (const locale of ["fa", "en"] as const) {
        for (const width of [1280, 390]) {
          await page.setViewportSize({ width, height: 900 });
          await open(page, locale, c);
          await page.screenshot({ path: path.join(SCREENS, `${c.name}-${width}-${locale}.png`), fullPage: true });
        }
      }
    }
  });
});
