import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const files = new Map([
  ['/','index.html'],
  ['/index.html','index.html'],
  ['/styles.css','styles.css'],
  ['/app.js','app.js'],
]);
const contentTypes = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
const port = Number(process.env.PORT) || 5173;

createServer(async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }

  const pathname = new URL(request.url, 'http://localhost').pathname;
  const filename = files.get(pathname);
  if (!filename) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
    return;
  }

  try {
    const body = await readFile(join(root, filename));
    response.writeHead(200, {
      'Content-Type': contentTypes[filename.slice(filename.lastIndexOf('.'))],
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch {
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Unable to load dashboard');
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`CircuitBreaker dashboard: http://127.0.0.1:${port}`);
});
