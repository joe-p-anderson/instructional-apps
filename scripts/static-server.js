// Tiny static file server for tests only. Playwright starts it in-process from
// tests/e2e/global-setup.js. The apps themselves are served as-is by GitHub Pages;
// this just mimics that locally. CLI use: node scripts/static-server.js [port]
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

async function handle(req, res) {
  try {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = normalize(join(root, urlPath));
    if (file !== root && !file.startsWith(root + sep)) {
      res.writeHead(403).end();
      return;
    }
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
}

/** Start the server on `port` (0 = any free port). Resolves to { port, close() }. */
export function startStaticServer(port = 0) {
  const server = createServer(handle);
  return new Promise((resolveStart, reject) => {
    server.on('error', reject);
    server.listen(port, () => resolveStart({
      port: server.address().port,
      close: () => new Promise((done) => { server.closeAllConnections(); server.close(() => done()); }),
    }));
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { port } = await startStaticServer(Number(process.argv[2] || process.env.PORT || 4173));
  console.log(`static server on http://localhost:${port}`);
}
