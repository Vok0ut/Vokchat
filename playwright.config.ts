import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Algunos entornos de desarrollo traen un Chromium preinstalado en una ruta fija con
// una revisión distinta a la que espera esta versión de Playwright. Si existe, se usa
// directamente en vez de forzar una descarga; si no, Playwright resuelve el binario
// estándar como de costumbre (p. ej. en CI, tras `playwright install`).
const SANDBOX_CHROMIUM = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const sandboxExecutablePath = existsSync(SANDBOX_CHROMIUM) ? SANDBOX_CHROMIUM : undefined;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: sandboxExecutablePath ? { executablePath: sandboxExecutablePath } : undefined,
      },
    },
  ],
  webServer: {
    command: "npm run build && npm run start -- -p 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
