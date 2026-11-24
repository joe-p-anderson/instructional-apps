import { defineConfig, devices } from '@playwright/test';
import { createServer } from 'node:net';

// Each run gets its own static server on its own port, so parallel worktrees
// never test another worktree's files. PW_PORT pins the port when needed.
// The config is evaluated in worker processes too, so the chosen port is passed
// down through the environment.
async function freePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.unref();
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
    reuseExistingServer: false,
  },
});
