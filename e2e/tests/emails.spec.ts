import { expect, test } from "@playwright/test";
import { API, addPhoto, adminLogin, createAdmin, createListing, register } from "./helpers";

/**
 * The review-result email on the running stack (feature 013): the decision writes it to the outbox, the
 * worker sends it to Mailpit, and the host's address is the one on the account. Mailpit's API is at :8025.
 */
const MAILPIT = process.env.MAILPIT_URL ?? "http://localhost:8025";

type Message = { ID: string; To: { Address: string }[]; Subject: string };

async function messageTo(request: Parameters<typeof register>[0], address: string): Promise<Message | undefined> {
  const res = await request.get(`${MAILPIT}/api/v1/search`, { params: { query: `to:"${address}"` } });
  expect(res.status()).toBe(200);
  return ((await res.json()) as { messages: Message[] }).messages[0];
}

test.describe("Review-result emails", () => {
  test.describe.configure({ timeout: 60_000 });

  test("a euro listing's host gets the approval in English only", async ({ request }) => {
    const host = await register(request, "mailhost");
    await createListing(request, host, { title: "E2E email courtyard" }); // EUR, and approves it
    await expect.poll(() => messageTo(request, host.email), { timeout: 30_000 }).toBeTruthy();
    const message = (await messageTo(request, host.email))!;
    expect(message.Subject).toBe("Your listing is approved");
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
    for (const caption of ["A", "B", "C"]) await addPhoto(request, host, listing.id, caption, { approved: false });
    const admin = await adminLogin(request, createAdmin("mailer").email);
    const detail = await (await request.get(`${API}/admin/listings/${listing.id}`, { headers: admin })).json();
    const rejected = await request.post(`${API}/admin/listings/${listing.id}/reject`, {
      headers: admin,
      data: { review_version: detail.review_version, reason: "Please add a photo of the bathroom." },
    });
    expect(rejected.status()).toBe(200);
    await expect.poll(() => messageTo(request, host.email), { timeout: 30_000 }).toBeTruthy();
    const message = (await messageTo(request, host.email))!;
    const body = await (await request.get(`${MAILPIT}/api/v1/message/${message.ID}`)).json();
    expect(message.Subject).toBe("آگهی شما رد شد");
    expect(body.Text).toContain("دلیل: Please add a photo of the bathroom.");
    expect(body.Text).toMatch(/\/fa\/host\/listings\/\d+/);
    expect(body.Text).not.toContain("Reason");
  });
});
