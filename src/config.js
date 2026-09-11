export function loadConfig(env = process.env) {
  return Object.freeze({
    port: positiveInt(env.PORT, 3000),
    spotSymbol: env.SPOT_SYMBOL || 'RSTRCUSDT',
    futuresSymbol: env.FUTURES_SYMBOL || 'STRCUSDT',
    hedgeRatio: positiveDecimal(env.HEDGE_RATIO, '1'),
    // STRCUSDT is configured at two quantity decimal places. Keep these
    // conservative fallbacks aligned so dry-run intents cannot contain a
    // third decimal place that the contract rejects.
    qtyStep: positiveDecimal(env.FUTURES_QTY_STEP, '0.01'),
    minQty: positiveDecimal(env.FUTURES_MIN_QTY, '0.01'),
    maxHedgeDelayMs: positiveInt(env.MAX_HEDGE_DELAY_MS, 3000),
    stateFile: env.STATE_FILE || 'data/state.json',
    privateWsUrl: env.BITGET_PRIVATE_WS_URL || '',
    telegramToken: env.TELEGRAM_BOT_TOKEN || '',
    telegramChatId: env.TELEGRAM_CHAT_ID || ''
  });
}

function positiveInt(value, fallback) {
  const n = Number(value ?? fallback);
  if (!Number.isInteger(n) || n <= 0) throw new Error(`expected positive integer, got ${value}`);
  return n;
}
function positiveDecimal(value, fallback) {
  const text = String(value ?? fallback);
  if (!/^\d+(\.\d+)?$/.test(text) || /^0(?:\.0+)?$/.test(text)) throw new Error(`expected positive decimal, got ${value}`);
  return text;
}
