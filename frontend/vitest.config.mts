import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    // next-intl imports "next/server" without a file extension; Vite resolves it when it bundles next-intl.
    server: { deps: { inline: ["next-intl"] } },
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/api/schema.d.ts", "src/components/ui/**", "src/test/**", "src/**/*.test.{ts,tsx}"],
      // The rules live in src/lib and src/api, so the 90% gate applies there (research R16). Component
      // coverage is reported but is not a gate: every acceptance scenario has its own component test.
      thresholds: {
        "src/lib/**": { lines: 90, branches: 90, functions: 90, statements: 90 },
        "src/api/**": { lines: 90, branches: 90, functions: 90, statements: 90 },
      },
    },
  },
});
