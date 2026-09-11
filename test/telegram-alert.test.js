import assert from 'node:assert/strict';
import test from 'node:test';
import { TelegramAlert } from '../src/alerts/telegram-alert.js';

test('Telegram alert safely degrades to a local log when secrets are absent', async () => {
  const lines = []; const alert = new TelegramAlert({ logger: { info: (line) => lines.push(line), error: () => {} } });
  assert.deepEqual(await alert.send('recovery required'), { delivered: false, reason: 'not-configured' });
  assert.match(lines[0], /telegram-disabled/);
});
