import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  // Single worker: many concurrent browser contexts hammering one local
  // `next dev` process (Turbopack, cold compiles) plus a real Supabase
  // backend caused logins to time out under 4-way parallelism.
  workers: 1,
  // Generous: the very first navigation against a cold Turbopack dev server
  // can take well over 15s to compile a route for the first time.
  timeout: 60_000,
  // First-navigation-after-server-(re)start assertions have been observed to
  // need more than the 5s default against a cold Turbopack compile.
  expect: { timeout: 10_000 },
  reporter: "html",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100",
    // Pinned so unprefixed (fr, default-locale) routes don't get
    // Accept-Language-negotiated to English — all our selectors are French.
    locale: "fr-FR",
    viewport: { width: 1280, height: 800 },
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    // Dedicated port: port 3000 is often occupied by another project's dev
    // server on this machine, and reuseExistingServer would otherwise happily
    // "reuse" that unrelated server instead of starting Friendszy's.
    command: "npm run dev -- -p 3100",
    url: "http://localhost:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "setup",
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: "chromium",
      testIgnore: /.*\.setup\.ts/,
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
  ],
});
