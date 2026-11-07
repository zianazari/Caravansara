import { expect, test } from "@playwright/test";
import {
  API,
  AMSTERDAM,
  adminLogin,
  auth,
  createAdmin,
  createListing,
  day,
  expectError,
  register,
  reserve,
} from "./helpers";

/** Listing review (specs/004-listing-approval) on the real stack, with an admin from create-admin. */

// Few listings take 47 guests, so the new one is on the first page however full the database is.
const GUESTS = 47;
const near = { lat: AMSTERDAM.lat, lng: AMSTERDAM.lng, radius_km: 5, adults: GUESTS, limit: 100 };

async function foundIds(request: Parameters<typeof register>[0]) {
  const res = await request.get(`${API}/search/listings`, { params: near });
  expect(res.status()).toBe(200);
  return (await res.json()).items.map((i: { id: number }) => i.id);
}

test.describe("Listing review", () => {
  test("a new listing is public only after an admin approves it", async ({ request }) => {
    const host = await register(request, "host");
    const guest = await register(request, "guest");
    const listing = await createListing(request, host, { max_guests: GUESTS }, { approved: false });
    expect(listing.review.status).toBe("pending");

    expect(await foundIds(request)).not.toContain(listing.id);
    await expectError(await request.get(`${API}/listings/${listing.id}`), 404, "not_found");
    await expectError(await reserve(request, guest, listing.id), 404, "not_found");

    const { email } = createAdmin("approver");
    const admin = await adminLogin(request, email);
    const queue = await request.get(`${API}/admin/listings/pending`, { headers: admin, params: { limit: 100 } });
    expect(queue.status()).toBe(200);
    expect((await queue.json()).items.map((i: { id: number }) => i.id)).toContain(listing.id);

    const detail = await (await request.get(`${API}/admin/listings/${listing.id}`, { headers: admin })).json();
    expect(detail.private_location).toMatchObject({ address: "Herengracht 1, Amsterdam" });
    const approved = await request.post(`${API}/admin/listings/${listing.id}/approve`, {
      headers: admin,
      data: { review_version: detail.review_version },
    });
    expect(approved.status(), await approved.text()).toBe(200);

    expect(await foundIds(request)).toContain(listing.id);
    const booking = await reserve(request, guest, listing.id, day(50), day(52));
    expect(booking.status(), await booking.text()).toBe(201);
  });

  test("a rejected listing shows its reason, is fixed and sent again", async ({ request }) => {
    const host = await register(request, "host");
    const listing = await createListing(request, host, {}, { approved: false });
    const admin = await adminLogin(request, createAdmin("rejecter").email);
    const version = (await (await request.get(`${API}/admin/listings/${listing.id}`, { headers: admin })).json())
      .review_version;

    await expectError(
      await request.post(`${API}/admin/listings/${listing.id}/reject`, {
        headers: admin,
        data: { review_version: version, reason: "   " },
      }),
      422,
      "validation_error",
    );
    const rejected = await request.post(`${API}/admin/listings/${listing.id}/reject`, {
      headers: admin,
      data: { review_version: version, reason: "The photos are not of this flat." },
    });
    expect(rejected.status(), await rejected.text()).toBe(200);

    const mine = await (await request.get(`${API}/me/listings`, { headers: auth(host) })).json();
    expect(mine.items[0].review).toMatchObject({ status: "rejected", rejection_reason: "The photos are not of this flat." });

    await request.patch(`${API}/listings/${listing.id}`, { headers: auth(host), data: { title: "Real photos now" } });
    const sent = await request.post(`${API}/listings/${listing.id}/resubmit`, { headers: auth(host) });
    expect(sent.status(), await sent.text()).toBe(200);
    expect((await sent.json()).review).toMatchObject({ status: "pending", rejection_reason: null });
    await expectError(
      await request.post(`${API}/listings/${listing.id}/resubmit`, { headers: auth(host) }),
      409,
      "listing_not_rejected",
    );
  });

  test("an admin token works on no member endpoint, and a member is no admin", async ({ request }) => {
    const member = await register(request, "member");
    const admin = await adminLogin(request, createAdmin("outsider").email);
    await expectError(await request.get(`${API}/me`, { headers: admin }), 401, "invalid_token");
    await expectError(await request.post(`${API}/listings`, { headers: admin, data: {} }), 401, "invalid_token");
    await expectError(await request.get(`${API}/admin/listings/pending`, { headers: auth(member) }), 401, "invalid_token");
    await expectError(
      await request.post(`${API}/admin/auth/login`, { data: { email: member.email, password: "E2e-Pass-2026!" } }),
      401,
      "invalid_credentials",
    );
  });
});
