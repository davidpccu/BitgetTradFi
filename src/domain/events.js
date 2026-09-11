const FILL_STATUSES = new Set(['filled', 'partialfilled', 'partiallyfilled', 'fullfill', 'partialfill']);

function normalizedStatus(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z]/g, '');
}

function firstValue(source, names) {
  for (const name of names) {
    if (source[name] !== undefined && source[name] !== null && source[name] !== '') return source[name];
  }
  return undefined;
}

export function normalizePrivateOrder(raw, config, receivedAt = Date.now()) {
  const symbol = String(firstValue(raw, ['symbol', 'instId']) ?? '').toUpperCase();
  const category = String(firstValue(raw, ['category', 'instType', 'productType']) ?? '').toUpperCase();
  const status = normalizedStatus(firstValue(raw, ['status', 'orderStatus', 'state']));
  const orderId = String(firstValue(raw, ['orderId', 'ordId']) ?? '');
  const clientOid = String(firstValue(raw, ['clientOid', 'clientOrderId', 'clOrdId']) ?? '');
  const side = String(firstValue(raw, ['side']) ?? '').toLowerCase();
  const tradeIdValue = firstValue(raw, ['tradeId', 'execId', 'fillId']);
  const tradeId = tradeIdValue === undefined ? '' : String(tradeIdValue);
  const lastFill = firstValue(raw, ['fillQty', 'execQty', 'lastFilledQty', 'lastFillQty']);
  const cumulativeFill = firstValue(raw, ['cumExecQty', 'cumFilledQty', 'filledQty', 'accFillSz', 'baseVolume']);
  const price = firstValue(raw, ['fillPrice', 'execPrice', 'priceAvg', 'avgPrice', 'price']);
  const exchangeTime = Number(firstValue(raw, ['fillTime', 'execTime', 'uTime', 'updatedTime', 'ts']) ?? receivedAt);

  const spotCategory = category.includes('SPOT') || category.includes('REALITY');
  const isFillStatus = FILL_STATUSES.has(status);
  const quantity = tradeId && lastFill !== undefined ? String(lastFill) : cumulativeFill === undefined ? '' : String(cumulativeFill);

  return {
    raw,
    symbol,
    category,
    status,
    orderId,
    clientOid,
    side,
    tradeId,
    quantity,
    quantityKind: tradeId && lastFill !== undefined ? 'incremental' : 'cumulative',
    price: price === undefined ? '' : String(price),
    exchangeTime: Number.isFinite(exchangeTime) ? exchangeTime : receivedAt,
    receivedAt,
    eligible: spotCategory && symbol === config.spotSymbol && isFillStatus && (side === 'buy' || side === 'sell'),
    ignoredReason: !spotCategory ? 'not-spot' : symbol !== config.spotSymbol ? 'wrong-symbol' : !isFillStatus ? 'not-fill' : !(side === 'buy' || side === 'sell') ? 'invalid-side' : null
  };
}

export function extractRows(message) {
  if (!message || typeof message !== 'object' || !Array.isArray(message.data)) return [];
  return message.data.filter((row) => row && typeof row === 'object');
}
