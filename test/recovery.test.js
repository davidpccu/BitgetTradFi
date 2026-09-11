import assert from 'node:assert/strict';
import test from 'node:test';
import { StateStore } from '../src/domain/state-store.js';
import { RecoveryWorker } from '../src/workers/recovery-worker.js';
import { alerts, config } from '../support/fixture-support.js';

test('recovery is fail-closed without authenticated private and public streams', async () => {
  const store = new StateStore(); await store.load();
  const worker = new RecoveryWorker({ config: config({ BITGET_API_KEY: '', BITGET_API_SECRET: '', BITGET_API_PASSPHRASE: '' }), store, alerts: alerts(), now: () => 100 });
  const result = await worker.run();
  assert.equal(result.ready, false); assert.equal(result.state.mode, 'recovery'); assert.match(result.state.protectionReason, /credentials missing/);
});

test('recovery can enter monitoring running only when both streams are ready', async () => {
  const store = new StateStore(); await store.load(); await store.update((state) => { state.privateConnected = true; state.publicConnected = true; });
  const worker = new RecoveryWorker({ config: config(), store, alerts: alerts(), now: () => 100 });
  const result = await worker.run();
  assert.equal(result.ready, true); assert.equal(result.state.mode, 'running');
});

test('unchanged recovery condition does not spam Telegram alerts', async () => {
  const store = new StateStore(); await store.load(); const alert = alerts();
  const worker = new RecoveryWorker({ config: config({ BITGET_API_KEY: '', BITGET_API_SECRET: '', BITGET_API_PASSPHRASE: '' }), store, alerts: alert, now: () => 100 });
  await worker.run(); await worker.run();
  assert.equal(alert.messages.length, 1);
});
