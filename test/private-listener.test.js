import assert from 'node:assert/strict';
import test from 'node:test';
import { HedgeCoordinator } from '../src/domain/hedge-coordinator.js';
import { StateStore } from '../src/domain/state-store.js';
import { BitgetPrivateFillListener, privateLogin } from '../src/exchange/bitget-private-listener.js';
import { alerts, config, FakeSocket, tick } from '../support/fixture-support.js';

test('private listener logs in, subscribes, ignores ACK, and forwards only fill semantics', async () => {
  const settings = config(); const store = new StateStore(); await store.load(); const alert = alerts(); const socket = new FakeSocket();
  const coordinator = new HedgeCoordinator({ config: settings, store, alerts: alert, now: () => 1_700_000_000_000 });
  const listener = new BitgetPrivateFillListener({ config: settings, store, alerts: alert, coordinator, socketFactory: () => socket, now: () => 1_700_000_000_000 });
  listener.start(); socket.emit('open');
  assert.equal(socket.sent[0].op, 'login'); assert.equal(socket.sent[0].args[0].apiKey, 'key'); assert.ok(socket.sent[0].args[0].sign);
  socket.emit('message', JSON.stringify({ event: 'login', code: '0' })); await tick();
  assert.equal(socket.sent[1].op, 'subscribe');
  socket.emit('message', JSON.stringify({ arg: { instType: 'SPOT' }, data: [{ symbol: 'RSTRCUSDT', orderId: 'o-1', side: 'buy', status: 'new', filledQty: '1' }] }));
  await tick(); assert.equal(store.snapshot().intents.length, 0);
  socket.emit('message', JSON.stringify({ arg: { instType: 'SPOT' }, data: [{ symbol: 'RSTRCUSDT', orderId: 'o-1', side: 'buy', status: 'filled', tradeId: 't-1', fillQty: '1' }] }));
  await tick(); assert.equal(store.snapshot().intents.length, 1);
  listener.stop();
});

test('login signature is deterministic and does not expose secret', () => {
  const login = privateLogin(config(), 1_700_000_000_000);
  assert.equal(login.args[0].timestamp, '1700000000'); assert.equal(JSON.stringify(login).includes('secret'), false);
});
