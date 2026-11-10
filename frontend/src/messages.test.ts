import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import en from "../messages/en.json";
import fa from "../messages/fa.json";

type Tree = { [key: string]: string | Tree };

function keys(tree: Tree, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([k, v]) =>
    typeof v === "string" ? [`${prefix}${k}`] : keys(v, `${prefix}${k}.`),
  );
}

function values(tree: Tree): string[] {
  return Object.values(tree).flatMap((v) => (typeof v === "string" ? [v] : values(v)));
}

function pyFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "__pycache__" ? [] : pyFiles(path);
    return name.endsWith(".py") ? [path] : [];
  });
}

/**
 * Every error code the backend can send. The API contract (openapi.json) lists only a few examples, so the
 * source is the backend code itself (research R7): the error classes' calls and their default codes.
 */
const CODE_PATTERNS = [
  /\b(?:Conflict|Unprocessable)\(\s*"([a-z_]+)"/g, // Conflict("dates_unavailable", …)
  /\bcode="([a-z_]+)"/g, // Forbidden(…, code="own_listing")
  /\b(?:AppError|super\(\)\.__init__)\(\s*\d+\s*,\s*"([a-z_]+)"/g, // super().__init__(429, "too_many_attempts", …)
  /\bcode: str = "([a-z_]+)"/g, // default codes of Forbidden and Unauthorized
  /_body\(\s*"([a-z_]+)"/g, // core/errors.py handlers
  /:\s*"([a-z_]+)"\s*,?\s*#?\s*$/gm, // _HTTP_CODES = {404: "not_found", …}
];

function backendErrorCodes(): Set<string> {
  const root = resolve(__dirname, "../../backend/src/caravansara");
  const codes = new Set<string>();
  for (const file of pyFiles(root)) {
    const text = readFileSync(file, "utf8");
    const isErrors = file.endsWith(join("core", "errors.py"));
    CODE_PATTERNS.forEach((pattern, index) => {
      if (index === CODE_PATTERNS.length - 1 && !isErrors) return; // the dict pattern only in core/errors.py
      for (const match of text.matchAll(pattern)) codes.add(match[1]!);
    });
  }
  return codes;
}

/** The 31 amenities of GET /amenities in caravansara_demo (db/demo, queried 2026-11-08). */
const DEMO_AMENITIES = [
  "Hot water",
  "Shampoo",
  "Hair dryer",
  "Iron",
  "Bed linens",
  "Dryer",
  "Washer",
  "TV",
  "High chair",
  "Crib",
  "Air conditioning",
  "Heating",
  "First aid kit",
  "Fire extinguisher",
  "Carbon monoxide alarm",
  "Smoke alarm",
  "Dedicated workspace",
  "Wifi",
  "Cooking basics",
  "Coffee maker",
  "Dishwasher",
  "Microwave",
  "Refrigerator",
  "Kitchen",
  "Lake access",
  "Sauna",
  "Balcony",
  "Hot tub",
  "Elevator",
  "Free parking",
  "Self check-in",
];

describe("messages", () => {
  it("have the same keys in Persian and English", () => {
    expect(keys(fa as Tree).sort()).toEqual(keys(en as Tree).sort());
  });

  it("have no empty text", () => {
    for (const text of [...values(fa as Tree), ...values(en as Tree)]) expect(text.trim()).not.toBe("");
  });

  it("translate every error code the backend can send (SC-007)", () => {
    const codes = backendErrorCodes();
    // Known codes from each pattern, so a pattern that silently stops matching fails here.
    for (const known of [
      "dates_unavailable",
      "own_listing",
      "too_many_attempts",
      "validation_error",
      "not_found",
      "forbidden",
      "unauthorized",
      "invalid_credentials",
      "email_taken",
    ]) {
      expect(codes).toContain(known);
    }
    const missing = [...codes].filter((code) => !(code in fa.errors) || !(code in en.errors));
    expect(missing).toEqual([]);
  });

  it("have no English in the Persian site, except a few names (SC-002)", () => {
    // Names that stay as they are: the map's data source, the image formats, and the other language's own name.
    const allowed = new Set(["OpenStreetMap", "PNG", "JPEG", "WebP", "English"]); // image formats keep their names
    const latin = values(fa as Tree)
      .map((text) =>
        text.replace(/\{[a-z]+, (plural|number)[^{}]*(\{[^{}]*\}[^{}]*)*\}/g, "").replace(/\{[a-z]+\}/g, ""),
      )
      .flatMap((text) => text.match(/[A-Za-z][A-Za-z.]*/g) ?? [])
      .filter((word) => !allowed.has(word));
    expect(latin).toEqual([]);
  });

  it("translate every demo amenity", () => {
    expect(DEMO_AMENITIES).toHaveLength(31);
    for (const name of DEMO_AMENITIES) {
      expect(fa.amenities).toHaveProperty([name]);
      expect(en.amenities).toHaveProperty([name]);
    }
  });
});
