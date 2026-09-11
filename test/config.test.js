import assert from 'node:assert/strict';
import test from 'node:test';
import { loadConfig } from '../src/config.js';

test('Phase 1 refuses to start when dry-run is disabled', () => {
  assert.throws(() => loadConfig({ DRY_RUN: 'false' }), /DRY_RUN must be true/);
});

test('configuration has no order endpoint', () => {
  const value = loadConfig({ DRY_RUN: 'true' });
  assert.equal(value.dryRun, true);
  assert.equal(Object.keys(value).some((key) => /order.*url|place.*order/i.test(key)), false);
});
