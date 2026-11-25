// Serve the repo for the e2e run from inside Playwright's own process.
// Playwright's webServer option runs the server as a child process and stops it
// with taskkill on Windows, which stalled teardown by ~85 s on the maintainer's
// machine and left orphaned servers holding ports.
import { startStaticServer } from '../../scripts/static-server.js';

export default async function globalSetup() {
  const server = await startStaticServer(Number(process.env.PW_PORT));
  return () => server.close();
}
