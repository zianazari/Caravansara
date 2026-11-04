import { expect, test } from "@playwright/test";
import { API, addPhoto, amenityIds, auth, createListing, day, register, reserve } from "./helpers";

/** The whole reservation story in one test, as a host and a guest would live it. */
test("host lists a place, guest finds it, books, pays, and both see the booking", async ({ request }) => {
  const ids = await amenityIds(request);

  // host: account, listing, photo
  const host = await register(request, "scenario-host");
  const listing = await createListing(request, host, {
    title: "E2E scenario loft",
    amenity_ids: [ids["Wifi"], ids["Heating"]].filter(Boolean),
  });
  await addPhoto(request, host, listing.id);

  // guest: account, search, details
  const guest = await register(request, "scenario-guest");
  const checkIn = day(35);
  const checkOut = day(38);
  const search = await request.get(`${API}/search/listings`, {
    params: {
      lat: listing.private_location.latitude,
      lng: listing.private_location.longitude,
      radius_km: 1,
      sort: "distance",
      check_in: checkIn,
      check_out: checkOut,
      adults: 2,
      limit: 100,
    },
  });
  const hit = (await search.json()).items.find((i: { id: number }) => i.id === listing.id);
  expect(hit).toMatchObject({ total_price: "390.00" });
  const detail = await (await request.get(`${API}/listings/${listing.id}`, { headers: auth(guest) })).json();
  expect(detail.private_location).toBeNull();

  // reserve → pay
  const booking = await (await reserve(request, guest, listing.id, checkIn, checkOut)).json();
  expect(booking.status).toBe("pending");
  const paid = await (await request.post(`${API}/bookings/${booking.id}/pay`, { headers: auth(guest) })).json();
  expect(paid.status).toBe("confirmed");

  // both sides see it; the nights are no longer available
  const trips = await (await request.get(`${API}/me/bookings`, { headers: auth(guest) })).json();
  expect(trips.items[0]).toMatchObject({ id: booking.id, status: "confirmed", address: { address: "Herengracht 1, Amsterdam" } });
  const hostSide = await (await request.get(`${API}/listings/${listing.id}/bookings`, { headers: auth(host) })).json();
  expect(hostSide.items.map((b: { id: number }) => b.id)).toEqual([booking.id]);

  const again = await request.get(`${API}/search/listings`, {
    params: { ...Object.fromEntries(new URL(search.url()).searchParams) },
  });
  expect((await again.json()).items.some((i: { id: number }) => i.id === listing.id)).toBe(false);
});
