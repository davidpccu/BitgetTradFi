import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const uiRoot = fileURLToPath(new URL('.', import.meta.url));
const assets = new Map([
  ['/assets/app.css', join(uiRoot, 'app.css')],
  ['/assets/app.js', join(uiRoot, 'app.js')]
]);
const contentTypes = { '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };

function headers(contentType) {
  return {
    'content-type': contentType,
    'cache-control': 'no-store',
    'content-security-policy': "default-src 'self'; connect-src 'self'; img-src 'self'; style-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    'referrer-policy': 'no-referrer',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY'
  };
}

function json(response, status, body) {
  response.writeHead(status, headers('application/json; charset=utf-8'));
  response.end(`${JSON.stringify(body)}\n`);
}

export function createPublicServer({ readModel }) {
  return createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.setHeader('allow', 'GET, HEAD'); json(response, 405, { error: 'read-only service' }); return;
    }
    if (url.pathname === '/api/public/market') { json(response, 200, readModel.market()); return; }
    if (url.pathname === '/api/public/status') { json(response, 200, readModel.status()); return; }
    if (url.pathname === '/api/public/events') {
      const limit = Number.parseInt(url.searchParams.get('limit') ?? '30', 10);
      json(response, 200, readModel.events(Number.isFinite(limit) ? limit : 30)); return;
    }
    if (url.pathname === '/health/live') { json(response, 200, { live: true, dryRun: true }); return; }
    if (url.pathname === '/health/ready') {
      const status = readModel.status(); json(response, status.mode === 'running' ? 200 : 503, { ready: status.mode === 'running', mode: status.mode, dryRun: true }); return;
    }
    if (assets.has(url.pathname)) {
      response.writeHead(200, headers(contentTypes[extname(url.pathname)]));
      if (request.method === 'HEAD') response.end(); else createReadStream(assets.get(url.pathname)).pipe(response);
      return;
    }
    if (url.pathname === '/') {
      const html = await readFile(join(uiRoot, 'index.html'));
      response.writeHead(200, headers('text/html; charset=utf-8'));
      response.end(request.method === 'HEAD' ? undefined : html); return;
    }
    json(response, 404, { error: 'not found' });
  });
}
