import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { API, auth, createListing, day, expectError, register, reserve, sql } from "./helpers";

test.describe("Bookings", () => {
  test("POST /bookings starts a 15-minute hold with a price snapshot", async ({ request }) => {
    const host = await register(request, "host");
    const guest = await register(request, "guest");
    const listing = await createListing(request, host);

    const res = await reserve(request, guest, listing.id, day(40), day(43));
    expect(res.status(), await res.text()).toBe(201);
    const booking = await res.json();
    expect(booking).toMatchObject({
      status: "pending",
      guest_id: guest.id,
      host_id: host.id,
      nights: 3,
      nightly_price: "120.00",
      cleaning_fee: "30.00",
      total_price: "390.00",
      currency: "EUR",
      address: null, // the address is shown only after payment
      listing: { id: listing.id, city: "Amsterdam" },
    });
    // Both times from the server: the test machine's clock may differ from the containers' by seconds
    // (Docker on macOS drifts), which made this check fail now and then (docs/future-work.md, 2026-11-10).
    const holdMinutes = (Date.parse(booking.hold_expires_at) - Date.parse(booking.created_at)) / 60_000;
    expect(holdMinutes).toBeGreaterThan(14.9);
    expect(holdMinutes).toBeLessThanOrEqual(15.01);
  });

  test("the same Idempotency-Key replays the booking (200) instead of booking twice", async ({ request }) => {
    const host = await register(request, "host");
    const guest = await register(request, "guest");
    const listing = await createListing(request, host);
    const key = randomUUID();

    const first = await reserve(request, guest, listing.id, day(40), day(42), {}, key);
    expect(first.status()).toBe(201);
    const replay = await reserve(request, guest, listing.id, day(40), day(42), {}, key);
    expect(replay.status()).toBe(200);
    expect((await replay.json()).id).toBe((await first.json()).id);

    await expectError(await reserve(request, guest, listing.id, day(60), day(62), {}, key), 422, "idempotency_key_reused");
  });

  test("overlapping dates are 409; back-to-back stays are fine", async ({ request }) => {
    const host = await register(request, "host");
    const a = await register(request, "guest-a");
    const b = await register(request, "guest-b");
    const listing = await createListing(request, host);

    expect((await reserve(request, a, listing.id, day(40), day(44))).status()).toBe(201);
    await expectError(await reserve(request, b, listing.id, day(43), day(45)), 409, "dates_unavailable");
    expect((await reserve(request, b, listing.id, day(44), day(46))).status()).toBe(201);
  });

  test("two guests reserving the same nights at the same moment: exactly one wins", async ({ request }) => {
    const host = await register(request, "host");
    const listing = await createListing(request, host);
    const guests = await Promise.all(Array.from({ length: 6 }, (_, i) => register(request, `racer-${i}`)));

    const results = await Promise.all(guests.map((g) => reserve(request, g, listing.id, day(70), day(73))));
    const statuses = results.map((r) => r.status()).sort();
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(5);
  });

  test("booking rules: own listing, dates, capacity, pets, unknown or inactive listing", async ({ request }) => {
    const host = await register(request, "host");
    const guest = await register(request, "guest");
    const listing = await createListing(request, host, { max_guests: 2, pets_allowed: true, max_pets: 1 });

    await expectError(await reserve(request, host, listing.id), 403, "own_listing");
    await expectError(await reserve(request, guest, listing.id, day(-2), day(1)), 422, "invalid_dates");
    await expectError(await reserve(request, guest, listing.id, day(10), day(10)), 422);
    await expectError(await reserve(request, guest, listing.id, day(400), day(402)), 422, "invalid_dates");
    await expectError(await reserve(request, guest, listing.id, day(10), day(12), { adults: 2, children: 1 }), 422, "capacity_exceeded");
    await expectError(await reserve(request, guest, listing.id, day(10), day(12), { pets: 2 }), 422, "capacity_exceeded");
    expect((await reserve(request, guest, listing.id, day(10), day(12), { infants: 2 })).status()).toBe(201);
    await expectError(await reserve(request, guest, 999999999), 404);

    const noPets = await createListing(request, host, { pets_allowed: false, max_pets: 0 });
    await expectError(await reserve(request, guest, noPets.id, day(10), day(12), { pets: 1 }), 422, "capacity_exceeded");

    await request.patch(`${API}/listings/${noPets.id}`, { headers: auth(host), data: { is_active: false } });
    await expectError(await reserve(request, guest, noPets.id, day(20), day(22)), 404);
  });

  test("POST /bookings needs a login and an Idempotency-Key", async ({ request }) => {
    const host = await register(request, "host");
    const guest = await register(request, "guest");
    const listing = await createListing(request, host);
    const data = { listing_id: listing.id, check_in: day(10), check_out: day(12) };
    await expectError(await request.post(`${API}/bookings`, { data, headers: { "Idempotency-Key": randomUUID() } }), 401);
    await expectError(await request.post(`${API}/bookings`, { data, headers: auth(guest) }), 422, "validation_error");
  });

  test("POST /bookings/{id}/pay confirms and reveals the address; paying twice is 409", async ({ request }) => {
    const host = await register(request, "host");
    const guest = await register(request, "guest");
    const listing = await createListing(request, host);
    const booking = await (await reserve(request, guest, listing.id)).json();

    await expectError(await request.post(`${API}/bookings/${booking.id}/pay`, { headers: auth(host) }), 403);
    const res = await request.post(`${API}/bookings/${booking.id}/pay`, { headers: auth(guest) });
    expect(res.status()).toBe(200);
    const paid = await res.json();
    expect(paid).toMatchObject({ status: "confirmed", hold_expires_at: null });
    expect(paid.address).toMatchObject({ address: "Herengracht 1, Amsterdam", check_in_time: "15:00" });

    await expectError(await request.post(`${API}/bookings/${booking.id}/pay`, { headers: auth(guest) }), 409, "invalid_booking_state");
  });

  test("paying after the hold ran out is 409 hold_expired and frees the dates", async ({ request }) => {
    const host = await register(request, "host");
    const guest = await register(request, "guest");
    const other = await register(request, "other");
    const listing = await createListing(request, host);
    const booking = await (await reserve(request, guest, listing.id, day(40), day(42))).json();

    await sql("UPDATE bookings SET hold_expires_at = now() - interval '1 minute' WHERE id = $1", [booking.id]);
    await expectError(await request.post(`${API}/bookings/${booking.id}/pay`, { headers: auth(guest) }), 409, "hold_expired");
    const view = await (await request.get(`${API}/bookings/${booking.id}`, { headers: auth(guest) })).json();
    expect(view.status).toBe("expired");
    expect((await reserve(request, other, listing.id, day(40), day(42))).status()).toBe(201);
  });

  test("GET /bookings/{id} is for the guest and the host only", async ({ request }) => {
    const host = await register(request, "host");
    const guest = await register(request, "guest");
    const stranger = await register(request, "stranger");
    const listing = await createListing(request, host);
    const booking = await (await reserve(request, guest, listing.id)).json();

    for (const who of [guest, host]) {
      const res = await request.get(`${API}/bookings/${booking.id}`, { headers: auth(who) });
      expect(res.status()).toBe(200);
      expect((await res.json()).id).toBe(booking.id);
    }
    await expectError(await request.get(`${API}/bookings/${booking.id}`, { headers: auth(stranger) }), 404);
    await expectError(await request.get(`${API}/bookings/${booking.id}`), 401);
  });

  test("GET /me/bookings lists my trips and filters by status", async ({ request }) => {
    const host = await register(request, "host");
    const guest = await register(request, "guest");
    const listing = await createListing(request, host);
    const a = await (await reserve(request, guest, listing.id, day(40), day(42))).json();
    const b = await (await reserve(request, guest, listing.id, day(50), day(52))).json();
    await request.post(`${API}/bookings/${b.id}/pay`, { headers: auth(guest) });

    const all = await (await request.get(`${API}/me/bookings`, { headers: auth(guest) })).json();
    expect(all.total).toBe(2);
    expect(all.items.map((x: { id: number }) => x.id).sort()).toEqual([a.id, b.id].sort());

    const confirmed = await (await request.get(`${API}/me/bookings`, { headers: auth(guest), params: { status: "confirmed" } })).json();
    expect(confirmed.items.map((x: { id: number }) => x.id)).toEqual([b.id]);

    const hostTrips = await (await request.get(`${API}/me/bookings`, { headers: auth(host) })).json();
    expect(hostTrips.total).toBe(0);
  });

  test("POST /bookings/{id}/cancel: guest or host, before check-in, once", async ({ request }) => {
    const host = await register(request, "host");
    const guest = await register(request, "guest");
    const other = await register(request, "other");
    const listing = await createListing(request, host);

    const pending = await (await reserve(request, guest, listing.id, day(40), day(42))).json();
    const res = await request.post(`${API}/bookings/${pending.id}/cancel`, { headers: auth(guest) });
    expect(res.status()).toBe(200);
    expect((await res.json()).status).toBe("cancelled");
    await expectError(await request.post(`${API}/bookings/${pending.id}/cancel`, { headers: auth(guest) }), 409, "invalid_booking_state");

    // a cancelled booking frees its dates
    const confirmed = await (await reserve(request, other, listing.id, day(40), day(42))).json();
    await request.post(`${API}/bookings/${confirmed.id}/pay`, { headers: auth(other) });
    const byHost = await request.post(`${API}/bookings/${confirmed.id}/cancel`, { headers: auth(host) });
    expect(byHost.status()).toBe(200);
    expect((await byHost.json()).status).toBe("cancelled");

    // on the check-in day it is too late
    const today = await (await reserve(request, guest, listing.id, day(60), day(62))).json();
    await sql("UPDATE bookings SET check_in = CURRENT_DATE, check_out = CURRENT_DATE + 2 WHERE id = $1", [today.id]);
    await expectError(await request.post(`${API}/bookings/${today.id}/cancel`, { headers: auth(guest) }), 409, "invalid_booking_state");
  });

  test("GET /listings/{id}/bookings is for the host only", async ({ request }) => {
    const host = await register(request, "host");
    const guest = await register(request, "guest");
    const listing = await createListing(request, host);
    const booking = await (await reserve(request, guest, listing.id)).json();

    const res = await request.get(`${API}/listings/${listing.id}/bookings`, { headers: auth(host) });
    expect(res.status()).toBe(200);
    const page = await res.json();
    expect(page.items.map((b: { id: number }) => b.id)).toEqual([booking.id]);

    await expectError(await request.get(`${API}/listings/${listing.id}/bookings`, { headers: auth(guest) }), 403, "not_listing_host");
    await expectError(await request.get(`${API}/listings/999999999/bookings`, { headers: auth(host) }), 404);
  });
});
