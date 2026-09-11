import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import { StateStore } from '../src/domain/state-store.js';
import { createPublicServer } from '../src/public-ui/server.js';
import { PublicReadModel } from '../src/read-model/public-read-model.js';
import { config } from '../support/fixture-support.js';

test('public server exposes read model and rejects every write method', async (context) => {
  const settings = config(); const store = new StateStore(); await store.load();
  const readModel = new PublicReadModel({ config: settings, store, now: () => 1_700_000_000_000 });
  const server = createPublicServer({ readModel }); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  context.after(() => server.close()); const base = `http://127.0.0.1:${server.address().port}`;
  const status = await fetch(`${base}/api/public/status`); const body = await status.json();
  assert.equal(status.status, 200); assert.equal(body.dryRun, true); assert.equal(body.canTrade, false);
  const write = await fetch(`${base}/api/public/status`, { method: 'POST' });
  assert.equal(write.status, 405); assert.deepEqual(await write.json(), { error: 'read-only service' });
});

test('read model exposes reported market session and stale state', async () => {
  const settings = config(); const store = new StateStore(); await store.load();
  await store.update((state) => {
    state.market.spot = { bid: '10', ask: '11', exchangeTime: 999, receivedAt: 999 };
    state.market.futures = { bid: '12', ask: '13', exchangeTime: 999, receivedAt: 999 };
    state.market.session = { status: 'open', source: 'bitget-ticker', updatedAt: 999 };
  });
  const market = new PublicReadModel({ config: settings, store, now: () => 1000 }).market();
  assert.equal(market.session.status, 'open'); assert.equal(market.spread, '1'); assert.equal(market.stale, false);
});
