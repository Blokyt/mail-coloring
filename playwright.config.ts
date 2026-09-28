import { defineConfig } from '@playwright/test'

// Port paramétrable : les E2E réutilisent le serveur de dev supervisé par
// Bravent (MailColorer/web) via E2E_PORT, sinon démarre le leur.
const PORT = Number(process.env.E2E_PORT ?? 5173)

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `pnpm exec vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
