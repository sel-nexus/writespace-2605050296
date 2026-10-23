/** Run access browser specs against a tier-local production preview. */
import { defineConfig } from '@playwright/test';
const port = Number(process.env.PLAYWRIGHT_PORT || 4173);
const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:' + port;
export default defineConfig({
  testDir: './e2e', workers: 1, fullyParallel: false,
  use: { baseURL, trace: 'retain-on-failure' },
  webServer: {
    command: 'node node_modules/vite/bin/vite.js preview --host 0.0.0.0 --strictPort --port ' + port,
    cwd: new URL('.', import.meta.url).pathname,
    url: baseURL, reuseExistingServer: false, timeout: 30000,
  },
});
