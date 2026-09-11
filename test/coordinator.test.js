import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizePrivateOrder } from '../src/domain/events.js';
import { HedgeCoordinator } from '../src/domain/hedge-coordinator.js';
import { StateStore } from '../src/domain/state-store.js';
import { alerts, config } from '../support/fixture-support.js';

async function subject(overrides = {}) {
  const settings = config(overrides); const store = new StateStore(); await store.load(); const alert = alerts();
  return { settings, store, alert, coordinator: new HedgeCoordinator({ config: settings, store, alerts: alert, now: () => 1_700_000_000_000 }) };
}

function event(settings, values) {
  return normalizePrivateOrder({ instType: 'SPOT', symbol: 'RSTRCUSDT', orderId: 'manual-12345678', side: 'buy', ...values }, settings, 1_700_000_000_000);
}

test('ACK/new with quantity never triggers a hedge intent', async () => {
  const { settings, store, coordinator } = await subject();
  const result = await coordinator.handle(event(settings, { status: 'new', filledQty: '5' }));
  assert.deepEqual(result, { action: 'ignored', reason: 'not-fill' });
  assert.equal(store.snapshot().intents.length, 0);
});

test('Spot buy FILL creates futures sell simulation from gross fill and ignores fee', async () => {
  const { settings, store, coordinator } = await subject();
  const result = await coordinator.handle(event(settings, { status: 'filled', tradeId: 'trade-1', fillQty: '2.5', fillPrice: '10', feeQty: '0.2' }));
  assert.equal(result.action, 'simulated');
  assert.equal(result.intent.side, 'sell'); assert.equal(result.intent.qty, '2.5'); assert.equal(result.intent.dryRun, true);
  assert.equal(store.snapshot().spotNetQty, '2.5');
  assert.equal(store.snapshot().futuresConfirmedQty, '0');
});

test('Spot sell FILL creates futures buy simulation', async () => {
  const { settings, coordinator } = await subject();
  const result = await coordinator.handle(event(settings, { side: 'sell', status: 'filled', tradeId: 'trade-2', fillQty: '1.2' }));
  assert.equal(result.intent.side, 'buy'); assert.equal(result.intent.qty, '1.2');
});

test('partial cumulative fills hedge only each new gross increment', async () => {
  const { settings, store, coordinator } = await subject();
  await coordinator.handle(event(settings, { status: 'partially_filled', filledQty: '1.2' }));
  const second = await coordinator.handle(event(settings, { status: 'filled', filledQty: '2.7' }));
  assert.equal(second.intent.qty, '1.5');
  assert.deepEqual(store.snapshot().intents.map((intent) => intent.qty), ['1.5', '1.2']);
  assert.equal(store.snapshot().spotNetQty, '2.7');
});

test('duplicate trade and self-prefixed order are ignored', async () => {
  const { settings, store, coordinator } = await subject();
  const fill = event(settings, { status: 'filled', tradeId: 'same', fillQty: '1' });
  await coordinator.handle(fill); const duplicate = await coordinator.handle(fill);
  const self = await coordinator.handle(event(settings, { status: 'filled', tradeId: 'other', fillQty: '1', clientOid: 'HEDGE_DRY_other' }));
  assert.equal(duplicate.action, 'ignored'); assert.equal(self.reason, 'self-order'); assert.equal(store.snapshot().intents.length, 1);
});

test('cumulative fill moving backwards enters recovery and never simulates another order', async () => {
  const { settings, store, coordinator } = await subject();
  await coordinator.handle(event(settings, { status: 'partially_filled', filledQty: '2' }));
  const result = await coordinator.handle(event(settings, { status: 'filled', filledQty: '1' }));
  assert.equal(result.action, 'recovery'); assert.equal(store.snapshot().mode, 'recovery'); assert.equal(store.snapshot().intents.length, 1);
});
