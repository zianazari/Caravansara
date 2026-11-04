import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { APIRequestContext, APIResponse, expect } from "@playwright/test";
import { Client } from "pg";

/** Every test makes its own users and listings, so tests never depend on each other. */

export const API = "/api/v1";
export const PASSWORD = "E2e-Pass-2026!";
export const AMSTERDAM = { lat: 52.3731, lng: 4.8922 };

export type User = { id: number; email: string; token: string; refresh: string };

export function auth(user: User) {
  return { Authorization: `Bearer ${user.token}` };
}

export function day(offset: number): string {
  return new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
}

export async function expectError(res: APIResponse, status: number, code?: string) {
  expect(res.status(), await res.text()).toBe(status);
  const body = await res.json();
  expect(body).toHaveProperty("error.message");
  if (code) expect(body.error.code).toBe(code);
  return body.error;
}

export async function register(request: APIRequestContext, name = "user"): Promise<User> {
  const email = `e2e.${name}.${randomUUID().slice(0, 8)}@caravansara.example.com`;
  const res = await request.post(`${API}/auth/register`, {
    data: { email, password: PASSWORD, full_name: `E2E ${name}` },
  });
  expect(res.status(), await res.text()).toBe(201);
  const body = await res.json();
  return { id: body.user.id, email, token: body.tokens.access_token, refresh: body.tokens.refresh_token };
}

let amenityCache: Record<string, number> | undefined;
export async function amenityIds(request: APIRequestContext): Promise<Record<string, number>> {
  if (!amenityCache) {
    const res = await request.get(`${API}/amenities`);
    expect(res.ok()).toBeTruthy();
    const groups: { amenities: { id: number; name: string }[] }[] = await res.json();
    amenityCache = Object.fromEntries(groups.flatMap((g) => g.amenities.map((a) => [a.name, a.id])));
  }
  return amenityCache;
}

/** A listing at a random point inside Amsterdam, so radial searches find it. */
export async function createListing(request: APIRequestContext, host: User, extra: Record<string, unknown> = {}) {
  const res = await request.post(`${API}/listings`, {
    headers: auth(host),
    data: {
      title: "E2E canal house",
      description: "Created by the Playwright API tests.",
      property_type: "entire_place",
      city_id: 1,
      neighborhood: "Centrum",
      address: "Herengracht 1, Amsterdam",
      latitude: AMSTERDAM.lat + (Math.random() - 0.5) * 0.02,
      longitude: AMSTERDAM.lng + (Math.random() - 0.5) * 0.02,
      max_guests: 4,
      pets_allowed: true,
      max_pets: 1,
      bedrooms: 2,
      beds: 2,
      bathrooms: 1,
      price_per_night: 120,
      cleaning_fee: 30,
      currency: "EUR",
      ...extra,
    },
  });
  expect(res.status(), await res.text()).toBe(201);
  return res.json();
}

export async function reserve(
  request: APIRequestContext,
  guest: User,
  listingId: number,
  checkIn = day(40),
  checkOut = day(43),
  extra: Record<string, unknown> = {},
  key: string = randomUUID(),
) {
  return request.post(`${API}/bookings`, {
    headers: { ...auth(guest), "Idempotency-Key": key },
    data: { listing_id: listingId, check_in: checkIn, check_out: checkOut, adults: 2, ...extra },
  });
}

/** Upload the sample photo through the presigned POST and register it. */
export async function addPhoto(request: APIRequestContext, host: User, listingId: number, caption = "Living room") {
  const urlRes = await request.post(`${API}/listings/${listingId}/photos/upload-url`, {
    headers: auth(host),
    data: { content_type: "image/jpeg" },
  });
  expect(urlRes.status(), await urlRes.text()).toBe(200);
  const upload = await urlRes.json();
  const upRes = await request.post(upload.url, {
    multipart: {
      ...upload.fields,
      file: { name: "photo.jpg", mimeType: "image/jpeg", buffer: samplePhoto() },
    },
  });
  expect(upRes.status(), await upRes.text()).toBe(204);
  const res = await request.post(`${API}/listings/${listingId}/photos`, {
    headers: auth(host),
    data: { storage_key: upload.storage_key, width: 800, height: 394, caption, room_tag: "Living room" },
  });
  expect(res.status(), await res.text()).toBe(201);
  return res.json();
}

export function samplePhoto(): Buffer {
  return readFileSync(path.join(__dirname, "..", "..", "postman", "sample-photo.jpg"));
}

/**
 * Direct SQL, only for what the API cannot do on demand: move a stay into the past
 * (the worker completes stays after check-out) or let a hold run out.
 */
export async function sql(text: string, params: unknown[] = []) {
  const client = new Client({
    connectionString: process.env.DATABASE_URL ?? "postgresql://caravansara:caravansara@localhost:5432/caravansara",
  });
  await client.connect();
  try {
    return (await client.query(text, params)).rows;
  } finally {
    await client.end();
  }
}
