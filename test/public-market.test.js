import assert from 'node:assert/strict';
import test from 'node:test';
import { StateStore } from '../src/domain/state-store.js';
import { BitgetPublicMarketListener } from '../src/exchange/bitget-public-market.js';
import { alerts, config, FakeSocket, tick } from '../support/fixture-support.js';

test('public ticker updates bid/ask and reports Reality market session without guessing', async () => {
  const settings = config(); const store = new StateStore(); await store.load(); const socket = new FakeSocket();
  const listener = new BitgetPublicMarketListener({ config: settings, store, alerts: alerts(), socketFactory: () => socket, now: () => 1000 });
  listener.start(); socket.emit('open');
  socket.emit('message', JSON.stringify({ arg: { instId: 'RSTRCUSDT' }, data: [{ bidPr: '9.9', askPr: '10.1', marketStatus: 'OPEN', ts: 900 }] }));
  await tick();
  assert.deepEqual(store.snapshot().market.spot, { bid: '9.9', ask: '10.1', exchangeTime: 900, receivedAt: 1000 });
  assert.equal(store.snapshot().market.session.status, 'open');
  listener.stop();
});

test('market session remains unknown when exchange does not report it', async () => {
  const settings = config(); const store = new StateStore(); await store.load(); const socket = new FakeSocket();
  const listener = new BitgetPublicMarketListener({ config: settings, store, alerts: alerts(), socketFactory: () => socket, now: () => 1000 });
  listener.start(); socket.emit('open');
  socket.emit('message', JSON.stringify({ arg: { instId: 'RSTRCUSDT' }, data: [{ bidPr: '9.9', askPr: '10.1' }] }));
  await tick(); assert.equal(store.snapshot().market.session.status, 'unknown'); listener.stop();
});
