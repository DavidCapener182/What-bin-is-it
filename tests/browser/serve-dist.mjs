import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const root = resolve('dist');
const mime = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

createServer((request, response) => {
  const pathname = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
  const clean = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  const candidates = [
    join(root, clean),
    join(root, `${clean}.html`),
    join(root, clean, 'index.html'),
    join(root, 'index.html'),
  ];
  const file = candidates.find((candidate) => candidate.startsWith(root) && existsSync(candidate) && statSync(candidate).isFile());
  if (!file) {
    response.writeHead(404).end('Not found');
    return;
  }
  response.setHeader('cache-control', 'no-store');
  response.setHeader('content-type', mime[extname(file)] ?? 'application/octet-stream');
  createReadStream(file).pipe(response);
}).listen(4173, '127.0.0.1');
