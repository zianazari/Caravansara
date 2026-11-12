import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * The caravansara theme (specs/007-caravansara-theme, FR-002, SC-002): every text/background pair the pages
 * use meets WCAG AA. The pairs are the table in data-model.md; a new pair is added here before it is used.
 * jsdom cannot measure contrast on a real page, so the tokens themselves are checked with the WCAG formula.
 */
const css = readFileSync(resolve(__dirname, "app/globals.css"), "utf8");
const root = /:root\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";

function token(name: string): string {
  const value = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`).exec(root)?.[1];
  if (!value) throw new Error(`--${name} is not a #rrggbb colour in :root`);
  return value.toLowerCase();
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r!) + 0.7152 * lin(g!) + 0.0722 * lin(b!);
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

const TEXT = 4.5; // normal text
const NON_TEXT = 3; // icons, focus ring, large text

const PAIRS: [fg: string, bg: string, min: number][] = [
  ["foreground", "background", TEXT],
  ["foreground", "surface", TEXT],
  ["foreground", "card", TEXT],
  ["foreground", "muted", TEXT],
  ["muted-foreground", "background", TEXT],
  ["muted-foreground", "surface", TEXT],
  ["muted-foreground", "card", TEXT],
  ["muted-foreground", "muted", TEXT],
  ["primary", "background", TEXT],
  ["primary", "surface", TEXT],
  ["primary", "card", TEXT],
  ["primary", "muted", TEXT],
  ["primary-foreground", "primary", TEXT],
  ["primary-foreground", "copper", NON_TEXT], // the search button's gradient starts at copper; its icon is white
  ["destructive", "background", TEXT],
  ["destructive", "card", TEXT],
  ["copper", "background", NON_TEXT], // active category icon, map marker border
  ["ring", "background", NON_TEXT],
  ["ring", "card", NON_TEXT],
  ["on-dark", "night", TEXT], // hero title
  ["gold", "night", TEXT], // hero subtitle
  ["on-dark-muted", "foreground", TEXT], // footer text
  ["gold", "foreground", TEXT], // footer site name
  ["background", "foreground", TEXT], // gallery counter, dialog text over the dark overlay
];

describe("theme tokens", () => {
  it.each(PAIRS)("%s on %s reaches %s:1", (fg, bg, min) => {
    expect(contrast(token(fg), token(bg))).toBeGreaterThanOrEqual(min);
  });

  it("uses olive for buttons and keeps copper for decoration", () => {
    expect(token("primary")).toBe("#43533b");
    expect(contrast("#ffffff", "#b5651d")).toBeLessThan(TEXT);
  });

  it("keeps the boutique palette and copper brand accents", () => {
    expect(token("background")).toBe("#faf9f5");
    expect(token("foreground")).toBe("#292e27");
    expect(token("copper")).toBe("#b5651d");
    expect(token("amber")).toBe("#e08a2e");
    expect(token("night")).toBe("#07101e");
  });

  it("asks the browser for light form controls, whatever the system theme (edge case: dark mode)", () => {
    expect(root).toMatch(/color-scheme:\s*light/);
  });

  it("defines the arch shape and switches decoration off for reduced motion", () => {
    expect(css).toMatch(/\.arch\s*\{[^}]*mask-image/);
    expect(css).not.toMatch(/\.arch-soft/); // photos are plain rounded since feature 017
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  });
});
