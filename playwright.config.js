import { defineConfig, devices } from '@playwright/test';

// PW_PORT lets parallel worktrees each run their own server instead of reusing another's.
const port = Number(process.env.PW_PORT) || 4173;

export default defineConfig({
  testDir: 'tests/e2e',
  reporter: 'list',
  use: { baseURL: `http://localhost:${port}` },
  projects: [{
    name: 'chromium',
    // A typical laptop screen: the layout must fit without horizontal scrolling.
    use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 } },
  }],
  webServer: {
    command: `node scripts/static-server.js ${port}`,
    url: `http://localhost:${port}/package.json`,
    reuseExistingServer: !process.env.CI,
  },
});
