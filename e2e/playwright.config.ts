import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.API_URL ?? "http://localhost:8000",
    extraHTTPHeaders: { Accept: "application/json" },
    trace: "retain-on-failure",
  },
  projects: [{ name: "api" }],
});
