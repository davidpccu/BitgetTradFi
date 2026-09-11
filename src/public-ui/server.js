import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const htmlPath = fileURLToPath(new URL('./index.html', import.meta.url));

export function createPublicServer(readModel) {
  return createServer(async (req, res) => {
    setHeaders(res);
    if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'read_only' }, { Allow: 'GET, HEAD' });
    const path = new URL(req.url, 'http://localhost').pathname;
    if (path === '/') return send(res, 200, await readFile(htmlPath), 'text/html; charset=utf-8');
    if (path === '/ui.js') return send(res, 200, await readFile(fileURLToPath(new URL('./ui.js', import.meta.url))), 'text/javascript; charset=utf-8');
    if (path === '/health/live') return json(res, 200, { live: true });
    if (path === '/health/ready') { const status = readModel.status(); return json(res, status.status === 'running' ? 200 : 503, { ready: status.status === 'running', trader: status.status }); }
    const routes = { '/api/public/market': () => readModel.market(), '/api/public/status': () => readModel.status(), '/api/public/session': () => readModel.session(), '/api/public/events': () => readModel.events() };
    return routes[path] ? json(res, 200, routes[path]()) : json(res, 404, { error: 'not_found' });
  });
}
function setHeaders(res) { res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'"); res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer'); res.setHeader('Cache-Control', 'no-store'); }
function json(res, status, body, headers = {}) { for (const [key, value] of Object.entries(headers)) res.setHeader(key, value); send(res, status, JSON.stringify(body), 'application/json; charset=utf-8'); }
function send(res, status, body, type) { res.statusCode = status; res.setHeader('Content-Type', type); res.end(body); }
