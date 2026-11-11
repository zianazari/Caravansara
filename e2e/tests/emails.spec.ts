import { expect, test } from "@playwright/test";
import { API, addPhoto, adminLogin, auth, createAdmin, createListing, day, register, reserve } from "./helpers";

/**
 * The review-result email on the running stack (feature 013): the decision writes it to the outbox, the
 * worker sends it to Mailpit, and the host's address is the one on the account. Mailpit's API is at :8025.
 */
const MAILPIT = process.env.MAILPIT_URL ?? "http://localhost:8025";

type Message = { ID: string; To: { Address: string }[]; Subject: string };

/**
 * The message with this subject sent to this address. Found by subject, not "the newest": a host gets the
 * listing's approval email and later the booking email, and the worker may send them in either order, so the
 * newest message was sometimes the approval (the cause of a flaky booking-email test, fixed in 042).
 */
async function messageTo(
  request: Parameters<typeof register>[0],
  address: string,
  subject: string,
): Promise<Message | undefined> {
  const res = await request.get(`${MAILPIT}/api/v1/search`, { params: { query: `to:"${address}"` } });
  expect(res.status()).toBe(200);
  return ((await res.json()) as { messages: Message[] }).messages.find((m) => m.Subject === subject);
}

test.describe("Review-result emails", () => {
  test.describe.configure({ timeout: 60_000 });

  test("a euro listing's host gets the approval in English only", async ({ request }) => {
    const host = await register(request, "mailhost");
    await createListing(request, host, { title: "E2E email courtyard" }); // EUR, and approves it
    const subject = "Your listing is approved";
    await expect.poll(() => messageTo(request, host.email, subject), { timeout: 30_000 }).toBeTruthy();
    const message = (await messageTo(request, host.email, subject))!;
    const body = await (await request.get(`${MAILPIT}/api/v1/message/${message.ID}`)).json();
    expect(body.Text).toContain("E2E email courtyard");
    expect(body.Text).toMatch(/\/en\/host\/listings\/\d+/);
    expect(body.Text).not.toContain("آگهی");
  });

  test("a rial listing's host gets the rejection and its reason in Persian only", async ({ request }) => {
    const host = await register(request, "mailrejected");
    const listing = await createListing(
      request,
      host,
      { title: "E2E email rejected", currency: "IRR", price_per_night: 12000000, cleaning_fee: 0 },
      { approved: false },
    );
    for (const caption of ["A", "B", "C", "D", "E"]) await addPhoto(request, host, listing.id, caption, { approved: false });
    const admin = await adminLogin(request, createAdmin("mailer").email);
    const detail = await (await request.get(`${API}/admin/listings/${listing.id}`, { headers: admin })).json();
    const rejected = await request.post(`${API}/admin/listings/${listing.id}/reject`, {
      headers: admin,
      data: { review_version: detail.review_version, reason: "Please add a photo of the bathroom." },
    });
    expect(rejected.status()).toBe(200);
    const subject = "آگهی شما رد شد";
    await expect.poll(() => messageTo(request, host.email, subject), { timeout: 30_000 }).toBeTruthy();
    const message = (await messageTo(request, host.email, subject))!;
    const body = await (await request.get(`${MAILPIT}/api/v1/message/${message.ID}`)).json();
    expect(body.Text).toContain("دلیل: Please add a photo of the bathroom.");
    expect(body.Text).toMatch(/\/fa\/host\/listings\/\d+/);
    expect(body.Text).not.toContain("Reason");
  });

  test("a paid booking sends the guest and the host a confirmation (feature 016)", async ({ request }) => {
    const host = await register(request, "mailbookhost");
    const guest = await register(request, "mailbookguest");
    const listing = await createListing(request, host, { title: "E2E email booking" });
    const booking = await (await reserve(request, guest, listing.id, day(90), day(92))).json();
    expect((await request.post(`${API}/bookings/${booking.id}/pay`, { headers: auth(guest) })).status()).toBe(200);

    const toGuestSubject = "Your booking is confirmed";
    await expect.poll(() => messageTo(request, guest.email, toGuestSubject), { timeout: 30_000 }).toBeTruthy();
    const toGuest = (await messageTo(request, guest.email, toGuestSubject))!;
    const text = (await (await request.get(`${MAILPIT}/api/v1/message/${toGuest.ID}`)).json()).Text as string;
    expect(text).toContain(`/en/trips/${booking.id}`);
    expect(text).not.toContain("Herengracht"); // the exact address stays on the trip page

    // The host also got the listing's approval email; the booking email is found by its own subject.
    await expect
      .poll(() => messageTo(request, host.email, "New booking for your listing"), { timeout: 30_000 })
      .toBeTruthy();
  });
});
