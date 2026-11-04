import { expect, test } from "@playwright/test";
import { API, addPhoto, amenityIds, auth, createListing, day, expectError, register, reserve } from "./helpers";

type Item = { id: number; distance_km: number | null; total_price: string | null; cover_url: string | null };

/** Radial search around a listing's real point; the public pin is within 500 m of it. */
function around(listing: { private_location: { latitude: number; longitude: number } }, extra: Record<string, string | number> = {}) {
  return {
    lat: listing.private_location.latitude,
    lng: listing.private_location.longitude,
    radius_km: 1,
    sort: "distance",
    limit: 100,
    ...extra,
  };
}

async function search(request: Parameters<typeof register>[0], params: Record<string, string | number>) {
  const res = await request.get(`${API}/search/listings`, { params });
  expect(res.status(), await res.text()).toBe(200);
  return (await res.json()) as { items: Item[]; total: number; limit: number; offset: number };
}

test.describe("Search", () => {
  test("radial search finds a new listing with distance, total price and cover", async ({ request }) => {
    const host = await register(request, "host");
    const listing = await createListing(request, host);
    await addPhoto(request, host, listing.id);

    const page = await search(request, around(listing, { check_in: day(30), check_out: day(33), adults: 2 }));
    const hit = page.items.find((i) => i.id === listing.id);
    expect(hit).toBeTruthy();
    expect(hit!.distance_km).toBeLessThanOrEqual(0.5);
    expect(hit!.total_price).toBe("390.00"); // 3 × 120 + 30
    expect(hit!.cover_url).toContain("/caravansara-media/");

    const distances = page.items.map((i) => i.distance_km!);
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
  });

  test("city search pages through results sorted by rating", async ({ request }) => {
    const page = await search(request, { city_id: 1, limit: 5, offset: 0 });
    expect(page.items.length).toBeLessThanOrEqual(5);
    expect(page.total).toBeGreaterThan(0);
    const next = await search(request, { city_id: 1, limit: 5, offset: 5 });
    expect(next.offset).toBe(5);
    expect(next.items.map((i) => i.id)).not.toEqual(page.items.map((i) => i.id));
  });

  test("booked dates, too many guests, pets and inactive listings are filtered out", async ({ request }) => {
    const host = await register(request, "host");
    const guest = await register(request, "guest");
    const listing = await createListing(request, host, { max_guests: 2, pets_allowed: false, max_pets: 0 });
    const found = async (extra: Record<string, string | number>) =>
      (await search(request, around(listing, extra))).items.some((i) => i.id === listing.id);

    expect(await found({ check_in: day(50), check_out: day(52), adults: 2 })).toBe(true);
    expect(await found({ adults: 3 })).toBe(false);
    expect(await found({ adults: 1, children: 2 })).toBe(false);
    expect(await found({ adults: 2, infants: 2 })).toBe(true); // infants don't count
    expect(await found({ pets: 1 })).toBe(false);

    expect((await reserve(request, guest, listing.id, day(50), day(52))).status()).toBe(201);
    expect(await found({ check_in: day(51), check_out: day(53) })).toBe(false);
    expect(await found({ check_in: day(52), check_out: day(54) })).toBe(true); // arrive the day the last guest leaves

    await request.patch(`${API}/listings/${listing.id}`, { headers: auth(host), data: { is_active: false } });
    expect(await found({})).toBe(false);
  });

  test("amenity filters use AND logic", async ({ request }) => {
    const host = await register(request, "host");
    const ids = Object.values(await amenityIds(request));
    const listing = await createListing(request, host, { amenity_ids: [ids[0], ids[1]] });
    const hit = async (amenity_ids: number[]) => {
      const params = new URLSearchParams(Object.entries(around(listing)).map(([k, v]) => [k, String(v)]));
      amenity_ids.forEach((id) => params.append("amenity_ids", String(id)));
      const res = await request.get(`${API}/search/listings?${params}`);
      expect(res.status()).toBe(200);
      return (await res.json()).items.some((i: Item) => i.id === listing.id);
    };
    expect(await hit([ids[0]])).toBe(true);
    expect(await hit([ids[0], ids[1]])).toBe(true);
    expect(await hit([ids[0], ids[2]])).toBe(false);
  });

  test("invalid search areas and dates are 422", async ({ request }) => {
    const bad = async (params: Record<string, string | number>, code: string) =>
      expectError(await request.get(`${API}/search/listings`, { params }), 422, code);
    await bad({}, "invalid_search_area");
    await bad({ city_id: 1, lat: 52, lng: 4, radius_km: 5 }, "invalid_search_area");
    await bad({ lat: 52, lng: 4 }, "invalid_search_area");
    await bad({ lat: 52, lng: 4, radius_km: 500 }, "invalid_search_area");
    await bad({ city_id: 1, sort: "distance" }, "invalid_search_area");
    await bad({ city_id: 1, check_in: day(10) }, "invalid_dates");
    await bad({ city_id: 1, check_in: day(10), check_out: day(9) }, "invalid_dates");
  });

  test("GET /search/filters counts amenities over the matching listings", async ({ request }) => {
    const host = await register(request, "host");
    const ids = Object.values(await amenityIds(request));
    const listing = await createListing(request, host, { amenity_ids: [ids[0]] });
    const res = await request.get(`${API}/search/filters`, { params: around(listing) });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.total).toBeGreaterThanOrEqual(1);
    const counted = body.amenities.find((a: { id: number }) => a.id === ids[0]);
    expect(counted).toMatchObject({ name: expect.any(String), category: expect.any(String) });
    expect(counted.listings).toBeGreaterThanOrEqual(1);
    await expectError(await request.get(`${API}/search/filters`), 422, "invalid_search_area");
  });
});
