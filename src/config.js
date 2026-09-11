const decimalPattern = /^\d+(?:\.\d+)?$/;

function integer(name, value, fallback) {
  const parsed = Number.parseInt(value ?? String(fallback), 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer`);
  return parsed;
}

function decimal(name, value, fallback) {
  const result = value ?? fallback;
  if (!decimalPattern.test(result) || Number(result) <= 0) throw new Error(`${name} must be a positive decimal`);
  return result;
}

function subscriptions(name, raw, fallback) {
  if (!raw) return fallback;
  let parsed;
  try { parsed = JSON.parse(raw); } catch { throw new Error(`${name} must be valid JSON`); }
  if (!Array.isArray(parsed) || parsed.length === 0) throw new Error(`${name} must be a non-empty array`);
  return parsed;
}

export function loadConfig(env = process.env) {
  if ((env.DRY_RUN ?? 'true').toLowerCase() !== 'true') {
    throw new Error('Phase 1 safety invariant: DRY_RUN must be true');
  }
  const spotSymbol = env.SPOT_SYMBOL ?? 'RSTRCUSDT';
  const futuresSymbol = env.FUTURES_SYMBOL ?? 'STRCUSDT';
  return Object.freeze({
    dryRun: true,
    host: env.HOST ?? '0.0.0.0',
    port: integer('PORT', env.PORT, 3000),
    spotSymbol,
    futuresSymbol,
    hedgeRatio: decimal('HEDGE_RATIO', env.HEDGE_RATIO, '1.0'),
    hedgeClientOidPrefix: env.HEDGE_CLIENT_OID_PREFIX ?? 'HEDGE_',
    futuresQtyStep: decimal('FUTURES_QTY_STEP', env.FUTURES_QTY_STEP, '0.0001'),
    marketStaleMs: integer('MARKET_STALE_MS', env.MARKET_STALE_MS, 15_000),
    maxHedgeDelayMs: integer('MAX_HEDGE_DELAY_MS', env.MAX_HEDGE_DELAY_MS, 3_000),
    maxUnhedgedNotionalUsdt: decimal('MAX_UNHEDGED_NOTIONAL_USDT', env.MAX_UNHEDGED_NOTIONAL_USDT, '100'),
    publicWsUrl: env.BITGET_PUBLIC_WS_URL ?? 'wss://ws.bitget.com/v3/ws/public',
    privateWsUrl: env.BITGET_PRIVATE_WS_URL ?? 'wss://ws.bitget.com/v3/ws/private',
    publicSubscriptions: subscriptions('BITGET_PUBLIC_SUBSCRIPTIONS', env.BITGET_PUBLIC_SUBSCRIPTIONS, [
      { instType: 'SPOT', channel: 'ticker', instId: spotSymbol },
      { instType: 'USDT-FUTURES', channel: 'ticker', instId: futuresSymbol }
    ]),
    privateSubscriptions: subscriptions('BITGET_PRIVATE_SUBSCRIPTIONS', env.BITGET_PRIVATE_SUBSCRIPTIONS, [
      { instType: 'UTA', channel: 'orders', instId: 'default' }
    ]),
    apiKey: env.BITGET_API_KEY ?? '',
    apiSecret: env.BITGET_API_SECRET ?? '',
    apiPassphrase: env.BITGET_API_PASSPHRASE ?? '',
    telegramBotToken: env.TELEGRAM_BOT_TOKEN ?? '',
    telegramChatId: env.TELEGRAM_CHAT_ID ?? '',
    stateFile: env.STATE_FILE ?? ''
  });
}
