import { EventEmitter } from 'node:events';
import { loadConfig } from '../src/config.js';

export function config(overrides = {}) {
  return loadConfig({
    DRY_RUN: 'true', PORT: '3000', SPOT_SYMBOL: 'RSTRCUSDT', FUTURES_SYMBOL: 'STRCUSDT',
    HEDGE_RATIO: '1', FUTURES_QTY_STEP: '0.1', MAX_UNHEDGED_NOTIONAL_USDT: '100',
    BITGET_API_KEY: 'key', BITGET_API_SECRET: 'secret', BITGET_API_PASSPHRASE: 'pass',
    ...overrides
  });
}

export class FakeSocket extends EventEmitter {
  sent = [];
  connectUrl = '';
  connect(url) { this.connectUrl = url; return this; }
  sendText(text) { this.sent.push(JSON.parse(text)); }
  close() { this.emit('close'); }
}

export const alerts = () => ({ messages: [], async send(message) { this.messages.push(message); return { delivered: true }; } });
export const tick = () => new Promise((resolve) => setImmediate(resolve));
