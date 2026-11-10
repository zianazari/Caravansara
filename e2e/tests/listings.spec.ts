import { expect, test } from "@playwright/test";
import { API, addPhoto, amenityIds, auth, createListing, expectError, register, samplePhoto } from "./helpers";

test.describe("Listings", () => {
  test("POST /listings creates a listing with amenities; the host sees the private location", async ({ request }) => {
    const host = await register(request, "host");
    const ids = await amenityIds(request);
    const listing = await createListing(request, host, { amenity_ids: [ids["Wifi"], ids["Kitchen"]].filter(Boolean) });
    expect(listing).toMatchObject({
      title: "E2E canal house",
      property_type: "entire_place",
      city: { name: "Amsterdam" },
      host: { id: host.id },
      is_active: true,
    });
    expect(Number(listing.price_per_night)).toBe(120);
    expect(listing.private_location).toMatchObject({ address: "Herengracht 1, Amsterdam" });
    expect(listing.amenities.flatMap((g: { amenities: unknown[] }) => g.amenities).length).toBeGreaterThan(0);
  });

  test("POST /listings validates input and needs a login", async ({ request }) => {
    const host = await register(request, "host");
    await expectError(await request.post(`${API}/listings`, { data: {} }), 401);
    await expectError(
      await request.post(`${API}/listings`, { headers: auth(host), data: { title: "Missing fields" } }),
      422,
      "validation_error",
    );
    const base = { title: "T", property_type: "entire_place", address: "A", latitude: 52.37, longitude: 4.89, max_guests: 2, price_per_night: 50 };
    await expectError(
      await request.post(`${API}/listings`, { headers: auth(host), data: { ...base, city_id: 999999 } }),
      422,
      "unknown_city",
    );
    await expectError(
      await request.post(`${API}/listings`, { headers: auth(host), data: { ...base, city_id: 1, amenity_ids: [32000] } }),
      422,
      "unknown_amenity",
    );
  });

  test("GET /listings/{id} is public but hides the private location from others", async ({ request }) => {
    const host = await register(request, "host");
    const listing = await createListing(request, host);
    const res = await request.get(`${API}/listings/${listing.id}`);
    expect(res.status()).toBe(200);
    const pub = await res.json();
    expect(pub.private_location).toBeNull();
    expect(pub.pin).toEqual({ lat: expect.any(Number), lng: expect.any(Number) });
    await expectError(await request.get(`${API}/listings/999999999`), 404);
  });

  test("GET /me/listings lists my listings, active and inactive", async ({ request }) => {
    const host = await register(request, "host");
    const a = await createListing(request, host, { title: "Active one" });
    const b = await createListing(request, host, { title: "Inactive one" });
    await request.patch(`${API}/listings/${b.id}`, { headers: auth(host), data: { is_active: false } });
    const res = await request.get(`${API}/me/listings`, { headers: auth(host) });
    expect(res.status()).toBe(200);
    const page = await res.json();
    expect(page.total).toBe(2);
    expect(page.items.map((l: { id: number }) => l.id).sort()).toEqual([a.id, b.id].sort());
    await expectError(await request.get(`${API}/me/listings`), 401);
  });

  test("PATCH /listings/{id} edits and deactivates; only the host may", async ({ request }) => {
    const host = await register(request, "host");
    const other = await register(request, "other");
    const listing = await createListing(request, host);

    const res = await request.patch(`${API}/listings/${listing.id}`, {
      headers: auth(host),
      data: { title: "Renamed house", price_per_night: 150 },
    });
    expect(res.status()).toBe(200);
    const edited = await res.json();
    expect(edited.title).toBe("Renamed house");
    expect(Number(edited.price_per_night)).toBe(150);

    await expectError(
      await request.patch(`${API}/listings/${listing.id}`, { headers: auth(other), data: { title: "Hijack" } }),
      403,
      "not_listing_host",
    );
    await expectError(
      await request.patch(`${API}/listings/${listing.id}`, { headers: auth(host), data: { title: null } }),
      422,
      "validation_error",
    );
    await expectError(
      await request.patch(`${API}/listings/${listing.id}`, { headers: auth(host), data: { pets_allowed: false, max_pets: 2 } }),
      422,
      "validation_error",
    );

    await request.patch(`${API}/listings/${listing.id}`, { headers: auth(host), data: { is_active: false } });
    await expectError(await request.get(`${API}/listings/${listing.id}`), 404);
    expect((await request.get(`${API}/listings/${listing.id}`, { headers: auth(host) })).status()).toBe(200);
  });

  test("PUT /listings/{id}/amenities replaces the amenity set", async ({ request }) => {
    const host = await register(request, "host");
    const other = await register(request, "other");
    const ids = Object.values(await amenityIds(request));
    const listing = await createListing(request, host, { amenity_ids: ids.slice(0, 3) });

    const res = await request.put(`${API}/listings/${listing.id}/amenities`, {
      headers: auth(host),
      data: { amenity_ids: [ids[5]] },
    });
    expect(res.status()).toBe(200);
    const got = (await res.json()).amenities.flatMap((g: { amenities: { id: number }[] }) => g.amenities.map((a) => a.id));
    expect(got).toEqual([ids[5]]);

    await expectError(
      await request.put(`${API}/listings/${listing.id}/amenities`, { headers: auth(other), data: { amenity_ids: [] } }),
      403,
      "not_listing_host",
    );
    await expectError(
      await request.put(`${API}/listings/${listing.id}/amenities`, { headers: auth(host), data: { amenity_ids: [32000] } }),
      422,
      "unknown_amenity",
    );
  });
});

test.describe("Listing photos", () => {
  test("upload URL → presigned upload → register → shows on the listing as the cover", async ({ request }) => {
    const host = await register(request, "host");
    const listing = await createListing(request, host);
    const photo = await addPhoto(request, host, listing.id);
    expect(photo).toMatchObject({ width: 800, height: 394, caption: "Living room", sort_order: expect.any(Number) });

    const file = await request.get(photo.url);
    expect(file.status()).toBe(200);
    expect((await file.body()).length).toBe(samplePhoto().length);

    const detail = await (await request.get(`${API}/listings/${listing.id}`)).json();
    // createListing gave it the 3 photos an admin needs (feature 010); the new one comes last.
    expect(detail.photos.map((p: { id: number }) => p.id).at(-1)).toBe(photo.id);
    expect(detail.photos).toHaveLength(4);
  });

  test("POST /photos/upload-url rejects other content types and non-hosts", async ({ request }) => {
    const host = await register(request, "host");
    const other = await register(request, "other");
    const listing = await createListing(request, host);
    await expectError(
      await request.post(`${API}/listings/${listing.id}/photos/upload-url`, { headers: auth(host), data: { content_type: "image/gif" } }),
      422,
    );
    await expectError(
      await request.post(`${API}/listings/${listing.id}/photos/upload-url`, { headers: auth(other), data: { content_type: "image/jpeg" } }),
      403,
    );
  });

  test("POST /photos refuses a key with no upload, a foreign key and a repeat", async ({ request }) => {
    const host = await register(request, "host");
    const listing = await createListing(request, host);
    const other = await createListing(request, host);

    const url = await (
      await request.post(`${API}/listings/${listing.id}/photos/upload-url`, { headers: auth(host), data: { content_type: "image/jpeg" } })
    ).json();
    const body = { storage_key: url.storage_key, width: 800, height: 394 };
    await expectError(
      await request.post(`${API}/listings/${listing.id}/photos`, { headers: auth(host), data: body }),
      422,
      "upload_missing",
    );
    await expectError(
      await request.post(`${API}/listings/${other.id}/photos`, { headers: auth(host), data: body }),
      422,
      "invalid_storage_key",
    );

    const photo = await addPhoto(request, host, listing.id);
    await expectError(
      await request.post(`${API}/listings/${listing.id}/photos`, {
        headers: auth(host),
        data: { storage_key: photo.storage_key, width: 800, height: 394 },
      }),
      422,
      "invalid_storage_key",
    );
  });

  test("PATCH /photos/{id} edits caption and room tag", async ({ request }) => {
    const host = await register(request, "host");
    const listing = await createListing(request, host);
    const photo = await addPhoto(request, host, listing.id);
    const res = await request.patch(`${API}/listings/${listing.id}/photos/${photo.id}`, {
      headers: auth(host),
      data: { caption: "Kitchen at noon", room_tag: "Kitchen" },
    });
    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({ caption: "Kitchen at noon", room_tag: "Kitchen" });
    await expectError(
      await request.patch(`${API}/listings/${listing.id}/photos/999999999`, { headers: auth(host), data: { caption: "x" } }),
      404,
    );
  });

  test("PUT /photos/order reorders photos; the first becomes the cover", async ({ request }) => {
    const host = await register(request, "host");
    const listing = await createListing(request, host);
    const first = await addPhoto(request, host, listing.id, "First");
    const second = await addPhoto(request, host, listing.id, "Second");
    const before = (await (await request.get(`${API}/listings/${listing.id}`)).json()).photos.map(
      (p: { id: number }) => p.id,
    );
    const order = [second.id, first.id, ...before.filter((id: number) => id !== first.id && id !== second.id)];

    const res = await request.put(`${API}/listings/${listing.id}/photos/order`, {
      headers: auth(host),
      data: { photo_ids: order },
    });
    expect(res.status()).toBe(200);
    const detail = await (await request.get(`${API}/listings/${listing.id}`)).json();
    expect(detail.photos.map((p: { id: number }) => p.id)).toEqual(order);

    await expectError(
      await request.put(`${API}/listings/${listing.id}/photos/order`, { headers: auth(host), data: { photo_ids: [first.id] } }),
      422,
      "invalid_photo_order",
    );
  });

  test("DELETE /photos/{id} removes a photo, but never one of the last 3 (feature 010)", async ({ request }) => {
    const host = await register(request, "host");
    const other = await register(request, "other");
    const listing = await createListing(request, host);
    const photo = await addPhoto(request, host, listing.id);

    await expectError(await request.delete(`${API}/listings/${listing.id}/photos/${photo.id}`, { headers: auth(other) }), 403);
    expect((await request.delete(`${API}/listings/${listing.id}/photos/${photo.id}`, { headers: auth(host) })).status()).toBe(204);
    const detail = await (await request.get(`${API}/listings/${listing.id}`)).json();
    expect(detail.photos).toHaveLength(3);
    expect(detail.photos.map((p: { id: number }) => p.id)).not.toContain(photo.id);
    await expectError(await request.delete(`${API}/listings/${listing.id}/photos/${photo.id}`, { headers: auth(host) }), 404);
    await expectError(
      await request.delete(`${API}/listings/${listing.id}/photos/${detail.photos[0].id}`, { headers: auth(host) }),
      409,
      "too_few_photos",
    );
  });
});
