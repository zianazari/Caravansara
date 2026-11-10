import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

/**
 * Colours come only from the theme tokens in src/app/globals.css (specs/007-caravansara-theme, FR-001,
 * SC-003), so the whole site changes in one place and every pair is checked by theme.test.ts.
 *
 * Allowed elsewhere: the default avatar colours (src/lib/avatar.ts, 005; they belong to the user, not the
 * theme) and the favicon (src/app/icon.svg; a browser tab cannot read the page's tokens).
 */
const SRC = resolve(__dirname);
const ALLOWED = new Set(["app/globals.css", "lib/avatar.ts", "app/icon.svg"]);

const RAW = [
  /#[0-9a-fA-F]{3,8}\b(?![\w-])/g, // hex
  /\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\(/g,
  // Tailwind's own palette: white and black, or a palette name with a shade (amber-500). A theme token may
  // share a palette name without a shade (from-amber is --amber), so a bare name is not caught.
  /\b(?:bg|text|border|fill|stroke|ring|from|to|via|outline|decoration|shadow)-(?:white|black)\b/g,
  /\b(?:bg|text|border|fill|stroke|ring|from|to|via|outline|decoration|shadow)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/g,
];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(tsx?|css|svg)$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });
}

describe("colours", () => {
  it("come only from the theme tokens", () => {
    const found: string[] = [];
    for (const file of files(SRC)) {
      const rel = relative(SRC, file).split("\\").join("/");
      if (ALLOWED.has(rel) || rel === "api/schema.d.ts") continue;
      // URL fragments such as href="#main" are not colours.
      const text = readFileSync(file, "utf8").replace(/(["'`(])#[\w-]+/g, "$1");
      for (const pattern of RAW) {
        for (const match of text.matchAll(pattern)) found.push(`${rel}: ${match[0]}`);
      }
    }
    expect(found).toEqual([]);
  });
});
