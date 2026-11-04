import { expect, test } from "@playwright/test";
import { API, User, auth, createListing, day, expectError, register, reserve, sql } from "./helpers";
import type { APIRequestContext } from "@playwright/test";

/**
 * A stay that ended `daysAgo` days ago. The API only books future dates and the worker
 * marks stays completed after check-out, so the test moves a paid booking to a one-night
 * stay in the past (use a different `daysAgo` per stay of one listing, or they overlap).
 */
async function completedStay(request: APIRequestContext, guest: User, listingId: number, daysAgo = 1, offset = 40) {
  const booking = await (await reserve(request, guest, listingId, day(offset), day(offset + 2))).json();
  expect((await request.post(`${API}/bookings/${booking.id}/pay`, { headers: auth(guest) })).status()).toBe(200);
  await sql(
    `UPDATE bookings SET check_in = CURRENT_DATE - ($2::int + 1), check_out = CURRENT_DATE - $2::int, status = 'completed'
     WHERE id = $1`,
    [booking.id, daysAgo],
  );
  return booking;
}

const review = { rating: 5, cleanliness_rating: 5, location_rating: 4, comment: "Lovely canal view, very clean." };

test.describe("Reviews", () => {
  test("POST /bookings/{id}/review after a completed stay updates the listing rating", async ({ request }) => {
    const host = await register(request, "host");
    const guest = await register(request, "guest");
    const listing = await createListing(request, host);
    const booking = await completedStay(request, guest, listing.id);

    const res = await request.post(`${API}/bookings/${booking.id}/review`, { headers: auth(guest), data: review });
    expect(res.status(), await res.text()).toBe(201);
    expect(await res.json()).toMatchObject({ rating: 5, comment: review.comment });

    const detail = await (await request.get(`${API}/listings/${listing.id}`)).json();
    expect(detail).toMatchObject({ avg_rating: "5.00", review_count: 1 });

    await expectError(
      await request.post(`${API}/bookings/${booking.id}/review`, { headers: auth(guest), data: review }),
      409,
      "already_reviewed",
    );
  });

  test("only the guest of a completed stay, within 14 days, may review", async ({ request }) => {
    const host = await register(request, "host");
    const guest = await register(request, "guest");
    const listing = await createListing(request, host);

    const upcoming = await (await reserve(request, guest, listing.id, day(80), day(82))).json();
    await expectError(
      await request.post(`${API}/bookings/${upcoming.id}/review`, { headers: auth(guest), data: review }),
      409,
      "invalid_booking_state",
    );

    const stay = await completedStay(request, guest, listing.id, 1, 40);
    await expectError(await request.post(`${API}/bookings/${stay.id}/review`, { headers: auth(host), data: review }), 404);
    await expectError(await request.post(`${API}/bookings/${stay.id}/review`, { data: review }), 401);
    await expectError(
      await request.post(`${API}/bookings/${stay.id}/review`, { headers: auth(guest), data: { rating: 6, comment: "x" } }),
      422,
      "validation_error",
    );

    const old = await completedStay(request, guest, listing.id, 15, 50);
    await expectError(
      await request.post(`${API}/bookings/${old.id}/review`, { headers: auth(guest), data: review }),
      403,
      "review_window_closed",
    );
    const lastDay = await completedStay(request, guest, listing.id, 14, 60);
    expect((await request.post(`${API}/bookings/${lastDay.id}/review`, { headers: auth(guest), data: review })).status()).toBe(201);
  });

  test("GET /listings/{id}/reviews is public, newest first, with the author", async ({ request }) => {
    const host = await register(request, "host");
    const listing = await createListing(request, host);
    for (const [i, rating] of [4, 2].entries()) {
      const guest = await register(request, `reviewer-${i}`);
      const stay = await completedStay(request, guest, listing.id, 1 + i * 2, 40 + i * 5);
      await request.post(`${API}/bookings/${stay.id}/review`, {
        headers: auth(guest),
        data: { rating, comment: `Review ${i}` },
      });
    }
    const res = await request.get(`${API}/listings/${listing.id}/reviews`);
    expect(res.status()).toBe(200);
    const page = await res.json();
    expect(page.total).toBe(2);
    expect(page.items.map((r: { comment: string }) => r.comment)).toEqual(["Review 1", "Review 0"]);
    expect(page.items[0]).toHaveProperty("author.full_name");

    const detail = await (await request.get(`${API}/listings/${listing.id}`)).json();
    expect(detail).toMatchObject({ avg_rating: "3.00", review_count: 2 });
    await expectError(await request.get(`${API}/listings/999999999/reviews`), 404);
  });
});
