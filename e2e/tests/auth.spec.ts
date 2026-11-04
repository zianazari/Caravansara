import { expect, test } from "@playwright/test";
import { API, PASSWORD, auth, expectError, register } from "./helpers";

test.describe("Auth and profile", () => {
  test("POST /auth/register creates a user and logs them in", async ({ request }) => {
    const user = await register(request, "register");
    expect(user.token).toBeTruthy();
    expect(user.refresh).toBeTruthy();
  });

  test("POST /auth/register rejects a taken email, a short password and a bad email", async ({ request }) => {
    const user = await register(request, "taken");
    await expectError(
      await request.post(`${API}/auth/register`, { data: { email: user.email, password: PASSWORD, full_name: "X" } }),
      409,
      "email_taken",
    );
    await expectError(
      await request.post(`${API}/auth/register`, { data: { email: "short@caravansara.example.com", password: "123", full_name: "X" } }),
      422,
      "validation_error",
    );
    await expectError(
      await request.post(`${API}/auth/register`, { data: { email: "not-an-email", password: PASSWORD, full_name: "X" } }),
      422,
      "validation_error",
    );
  });

  test("POST /auth/login returns tokens; a wrong password is 401", async ({ request }) => {
    const user = await register(request, "login");
    const res = await request.post(`${API}/auth/login`, { data: { email: user.email, password: PASSWORD } });
    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({ token_type: "bearer", expires_in: expect.any(Number) });

    await expectError(
      await request.post(`${API}/auth/login`, { data: { email: user.email, password: "Wrong-Pass-1" } }),
      401,
      "invalid_credentials",
    );
  });

  test("POST /auth/refresh rotates tokens; reusing an old one revokes every session", async ({ request }) => {
    const user = await register(request, "refresh");
    const res = await request.post(`${API}/auth/refresh`, { data: { refresh_token: user.refresh } });
    expect(res.status()).toBe(200);
    const fresh = await res.json();
    expect(fresh.refresh_token).not.toBe(user.refresh);
    const next = await request.post(`${API}/auth/refresh`, { data: { refresh_token: fresh.refresh_token } });
    expect(next.status()).toBe(200);
    const latest = await next.json();

    await expectError(
      await request.post(`${API}/auth/refresh`, { data: { refresh_token: user.refresh } }),
      401,
      "invalid_token",
    );
    // a replayed token looks stolen, so the newer token is revoked too
    await expectError(
      await request.post(`${API}/auth/refresh`, { data: { refresh_token: latest.refresh_token } }),
      401,
      "invalid_token",
    );
  });

  test("POST /auth/logout revokes the refresh token and accepts unknown tokens", async ({ request }) => {
    const user = await register(request, "logout");
    expect((await request.post(`${API}/auth/logout`, { data: { refresh_token: user.refresh } })).status()).toBe(204);
    await expectError(
      await request.post(`${API}/auth/refresh`, { data: { refresh_token: user.refresh } }),
      401,
      "invalid_token",
    );
    expect((await request.post(`${API}/auth/logout`, { data: { refresh_token: "unknown" } })).status()).toBe(204);
  });

  test("GET /me returns my profile; no or bad token is 401", async ({ request }) => {
    const user = await register(request, "me");
    const res = await request.get(`${API}/me`, { headers: auth(user) });
    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({ id: user.id, email: user.email, full_name: "E2E me" });

    await expectError(await request.get(`${API}/me`), 401, "unauthorized");
    await expectError(await request.get(`${API}/me`, { headers: { Authorization: "Bearer nope" } }), 401, "invalid_token");
  });

  test("PATCH /me updates the name and avatar", async ({ request }) => {
    const user = await register(request, "patch");
    const res = await request.patch(`${API}/me`, {
      headers: auth(user),
      data: { full_name: "Renamed Guest", avatar_url: "https://example.com/avatar.png" },
    });
    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({ full_name: "Renamed Guest", avatar_url: "https://example.com/avatar.png" });

    await expectError(await request.patch(`${API}/me`, { headers: auth(user), data: { full_name: "" } }), 422);
    await expectError(await request.patch(`${API}/me`, { data: { full_name: "X" } }), 401);
  });
});
