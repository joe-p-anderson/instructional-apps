import { defineConfig, devices } from '@playwright/test';
import { createServer } from 'node:net';

// Each run serves this checkout on its own free port (see global-setup.js), so
// parallel worktrees never test one another's files. PW_PORT pins the port.
// The config is evaluated again in each worker, so the chosen port is passed on
// through the environment.
function freePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.on('error', reject);
    srv.listen(0, () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

if (!process.env.PW_PORT) process.env.PW_PORT = String(await freePort());
const port = Number(process.env.PW_PORT);

export default defineConfig({
  testDir: 'tests/e2e',
  globalSetup: './tests/e2e/global-setup.js',
  reporter: 'list',
  use: { baseURL: `http://localhost:${port}` },
  projects: [{
    name: 'chromium',
    // A typical laptop screen: the layout must fit without horizontal scrolling.
    use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 } },
  }],
});
