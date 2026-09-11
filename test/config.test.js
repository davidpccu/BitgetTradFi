import test from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config.js';

test('STRCUSDT quantity fallbacks use the two-decimal contract precision', () => {
  const config = loadConfig({});
  assert.equal(config.futuresSymbol, 'STRCUSDT');
  assert.equal(config.qtyStep, '0.01');
  assert.equal(config.minQty, '0.01');
});

test('explicit instrument quantity limits override the STRCUSDT fallbacks', () => {
  const config = loadConfig({ FUTURES_QTY_STEP: '0.1', FUTURES_MIN_QTY: '0.2' });
  assert.equal(config.qtyStep, '0.1');
  assert.equal(config.minQty, '0.2');
});
