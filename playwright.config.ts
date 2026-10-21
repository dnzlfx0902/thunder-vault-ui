import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  webServer: { command: "rm -rf .e2e-data && APP_PASSWORD=test VAULT_ROOT=./test-vault APP_DATA_DIR=./.e2e-data HERMES_COMMAND='[\"node\",\"e2e/mock-hermes.mjs\"]' MARKITDOWN_COMMAND='[\"node\",\"e2e/mock-markitdown.mjs\"]' npm run dev", port: 3000, reuseExistingServer: false },
  use: { baseURL: "http://localhost:3000" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
