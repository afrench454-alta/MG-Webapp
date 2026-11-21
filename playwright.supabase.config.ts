import { defineConfig, devices } from "@playwright/test";

const app = "http://127.0.0.1:3210";
const service = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!service || !/^http:\/\/(127\.0\.0\.1|localhost):54321$/.test(service) || !publishableKey) {
  throw new Error("Run the authenticated browser checks through scripts/check-local-supabase.mjs --browser.");
}

export default defineConfig({
  testDir: "./tests/integration",
  reporter: [["list"], ["json", { outputFile: "test-results/supabase-browser.json" }]],
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    ...devices["Desktop Chrome"],
    baseURL: app,
  },
  webServer: {
    command: "npm run build && npm run start -- --hostname 127.0.0.1 --port 3210",
    url: `${app}/sign-in`,
    timeout: 240_000,
    reuseExistingServer: false,
    env: {
      NEXT_PUBLIC_APP_URL: app,
      NEXT_PUBLIC_SUPABASE_URL: service,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
      GEMINI_API_KEY: "",
      GOOGLE_API_KEY: "",
      XAI_API_KEY: "",
      OPENROUTER_API_KEY: "",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
