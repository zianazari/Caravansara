import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { API, PASSWORD, WEB, sql } from "./helpers";

/**
 * The web site on the running stack (specs/005-frontend-guest): what only the deployed wiring shows. The site
 * forwards /api/v1 to the API, keeps the refresh token in its own cookie, sends the visitor's address for the
 * rate limits, puts a content security policy on every page, and passes a profile picture to the API, which
 * checks it before storing it (specs/006-avatar-upload-via-api). Pages are tested with Vitest, and in a real
 * browser by theme.spec.ts (specs/007-caravansara-theme).
 */
const ORIGIN = { origin: WEB };

test.describe("Web site", () => {
  test("forwards /api/v1 to the API and nothing else (research R5)", async ({ request }) => {
    const direct = await request.get(`${API}/countries`);
    const viaSite = await request.get(`${WEB}${API}/countries`);
    expect(viaSite.status()).toBe(200);
    expect(await viaSite.json()).toEqual(await direct.json());
    expect(viaSite.headers()["date"]).toBeTruthy(); // the hold countdown uses the server's clock (R12)

    for (const path of ["/metrics", "/docs", "/health"]) {
      const res = await request.get(`${WEB}${path}`, { maxRedirects: 0 });
      expect(res.headers()["content-type"] ?? "").not.toContain("openmetrics");
      expect(await res.text()).not.toContain("http_requests_total");
    }
  });

  test("refuses the API's own login routes through the site (research R19)", async ({ request }) => {
    for (const path of ["auth/login", "auth/register", "auth/refresh", "auth/logout"]) {
      const res = await request.post(`${WEB}${API}/${path}`, { data: {} });
      expect(res.status(), path).toBe(404);
    }
  });

  test("keeps the refresh token in an HttpOnly cookie and refuses other sites", async ({ request }) => {
    const email = `e2e.web.${randomUUID().slice(0, 8)}@caravansara.example.com`;
    const res = await request.post(`${WEB}/session/register`, {
      headers: ORIGIN,
      data: { email, password: PASSWORD, full_name: "Web Visitor" },
    });
    expect(res.status(), await res.text()).toBe(201);
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(["access_token", "expires_in", "user"]);
    const cookie = res.headers()["set-cookie"] ?? "";
    expect(cookie).toMatch(/^cv_refresh=/);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=strict");
    expect(cookie).toContain("Path=/session");

    const refreshed = await request.post(`${WEB}/session/refresh`, { headers: ORIGIN });
    expect(refreshed.status()).toBe(200);
    const foreign = await request.post(`${WEB}/session/refresh`, { headers: { origin: "https://evil.example" } });
    expect(foreign.status()).toBe(403);
    expect((await foreign.json()).error.code).toBe("bad_origin");
  });

  test("counts login attempts by the visitor's address, not the site's (research R19)", async ({ request }) => {
    const email = `e2e.ip.${randomUUID().slice(0, 8)}@caravansara.example.com`;
    const tag = randomUUID().slice(0, 6);
    const a = `198.51.100.${parseInt(tag.slice(0, 2), 16) % 200}`;
    const b = `203.0.113.${parseInt(tag.slice(2, 4), 16) % 200}`;
    for (const address of [a, b]) {
      const res = await request.post(`${WEB}/session/login`, {
        headers: { ...ORIGIN, "x-forwarded-for": address },
        data: { email, password: "wrong-password" },
      });
      expect(res.status()).toBe(401);
    }
    // A direct call to the API with a made-up address is counted by its own connection, not the made-up one.
    const spoofed = `192.0.2.${parseInt(tag.slice(4, 6), 16) % 200}`;
    await request.post(`${API}/auth/login`, { headers: { "x-forwarded-for": spoofed }, data: { email, password: "wrong" } });

    const rows = await sql(
      "SELECT identifier FROM auth_attempts WHERE action = 'login' AND identifier = ANY($1) AND attempted_at > now() - interval '5 minutes'",
      [[a, b, spoofed]],
    );
    const seen = new Set(rows.map((r: { identifier: string }) => r.identifier));
    expect(seen.has(a)).toBe(true);
    expect(seen.has(b)).toBe(true);
    expect(seen.has(spoofed)).toBe(false);
  });

  test("puts a fresh nonce policy on every page (research R21)", async ({ request }) => {
    const first = await request.get(`${WEB}/fa`);
    const second = await request.get(`${WEB}/en`);
    const csp = first.headers()["content-security-policy"] ?? "";
    const nonce = /'nonce-([^']+)'/.exec(csp)?.[1];
    expect(nonce).toBeTruthy();
    expect(csp).toContain("frame-ancestors 'none'");
    expect(second.headers()["content-security-policy"]).not.toContain(nonce!);
    const html = await first.text();
    expect(html).toContain('<html lang="fa" dir="rtl"');
    expect(html.match(/<script/g)?.length ?? 0).toBeLessThanOrEqual(html.match(new RegExp(`nonce="${nonce!.replace(/[+/=]/g, "\\$&")}"`, "g"))?.length ?? 0);
  });

  // specs/006-avatar-upload-via-api: the picture goes through the site to the API, which checks it before
  // anything is stored; the old presigned route is gone, and the site caps a body before it reaches the API.
  test("uploads a profile picture through the API and refuses bad files (006)", async ({ request }) => {
    const email = `e2e.avatar.${randomUUID().slice(0, 8)}@caravansara.example.com`;
    const reg = await request.post(`${WEB}/session/register`, {
      headers: ORIGIN,
      data: { email, password: PASSWORD, full_name: "Avatar Visitor" },
    });
    const token = (await reg.json()).access_token as string;
    const authHeader = { authorization: `Bearer ${token}` };
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(200)]);

    const set = await request.put(`${WEB}${API}/me/avatar`, {
      headers: { ...authHeader, "content-type": "image/png" },
      data: png,
    });
    expect(set.status(), await set.text()).toBe(200);
    const url = (await set.json()).avatar_url as string;
    expect(url).toContain("/avatars/");
    const picture = await request.get(url);
    expect(picture.status()).toBe(200);
    expect(picture.headers()["content-type"]).toBe("image/png");

    const fake = await request.put(`${WEB}${API}/me/avatar`, {
      headers: { ...authHeader, "content-type": "image/png" },
      data: Buffer.from("just some text, not a picture"),
    });
    expect(fake.status()).toBe(422);
    expect((await fake.json()).error.code).toBe("invalid_image");

    const gif = await request.put(`${WEB}${API}/me/avatar`, {
      headers: { ...authHeader, "content-type": "image/gif" },
      data: Buffer.from("GIF89a"),
    });
    expect(gif.status()).toBe(415);
    expect((await gif.json()).error.code).toBe("unsupported_image_type");

    const big = await request.put(`${WEB}${API}/me/avatar`, {
      headers: { ...authHeader, "content-type": "image/png" },
      data: Buffer.concat([png, Buffer.alloc(6 * 1024 * 1024)]),
    });
    expect(big.status()).toBe(413);
    expect((await big.json()).error).toMatchObject({ code: "image_too_large", details: { max_bytes: 5242880 } });

    const me = await request.get(`${WEB}${API}/me`, { headers: authHeader });
    expect((await me.json()).avatar_url).toBe(url); // every refusal kept the picture

    const old = await request.post(`${WEB}${API}/me/avatar/upload-url`, {
      headers: authHeader,
      data: { content_type: "image/png" },
    });
    expect([404, 405]).toContain(old.status());
  });
});
