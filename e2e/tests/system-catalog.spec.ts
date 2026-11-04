import { expect, test } from "@playwright/test";
import { API, expectError } from "./helpers";

test.describe("System", () => {
  test("GET /health reports the API and the database", async ({ request }) => {
    const res = await request.get("/health");
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", database: "ok" });
  });

  test("Swagger UI and the OpenAPI document are served", async ({ request }) => {
    const docs = await request.get("/docs");
    expect(docs.status()).toBe(200);
    expect(await docs.text()).toContain("swagger-ui");
    const spec = await (await request.get(`${API}/openapi.json`)).json();
    expect(spec.openapi).toMatch(/^3\./);
    expect(Object.keys(spec.paths).length).toBeGreaterThanOrEqual(25);
  });

  test("an unknown path returns the common error shape", async ({ request }) => {
    await expectError(await request.get(`${API}/no-such-thing`), 404);
  });
});

test.describe("Catalog", () => {
  test("GET /countries lists countries with ISO codes", async ({ request }) => {
    const res = await request.get(`${API}/countries`);
    expect(res.status()).toBe(200);
    const countries = await res.json();
    expect(countries.length).toBeGreaterThan(0);
    expect(countries).toContainEqual(expect.objectContaining({ code: "NL", name: "Netherlands" }));
  });

  test("GET /cities autocompletes by name and filters by country", async ({ request }) => {
    const res = await request.get(`${API}/cities`, { params: { q: "Amst", country: "NL" } });
    expect(res.status()).toBe(200);
    const cities = await res.json();
    expect(cities[0]).toMatchObject({ name: "Amsterdam", timezone: "Europe/Amsterdam", country: { code: "NL" } });

    const limited = await (await request.get(`${API}/cities`, { params: { limit: 1 } })).json();
    expect(limited).toHaveLength(1);
  });

  test("GET /cities rejects a bad country code", async ({ request }) => {
    await expectError(await request.get(`${API}/cities`, { params: { country: "NLD" } }), 422, "validation_error");
  });

  test("GET /amenities groups amenities by category", async ({ request }) => {
    const res = await request.get(`${API}/amenities`);
    expect(res.status()).toBe(200);
    const groups = await res.json();
    expect(groups.length).toBeGreaterThan(1);
    for (const g of groups) {
      expect(g).toHaveProperty("name");
      expect(g.amenities.length).toBeGreaterThan(0);
    }
  });
});
