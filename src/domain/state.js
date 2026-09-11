export function initialState(now = new Date().toISOString()) {
  return {
    version: 1, mode: 'RECOVERY', dryRun: true, protectedReason: 'startup reconciliation required',
    spotFilledSignedQty: '0', futuresHedgedSignedQty: '0', intents: [], fills: [], events: [],
    processedTradeIds: [], orderHighWater: {}, lastReconciledAt: null,
    market: { spot: null, futures: null, stale: true, updatedAt: null },
    session: { phase: 'unknown', exchangeTimezone: 'unknown', isMarketOpenNow: false, exchangeTimestamp: null, localTimestamp: now }
  };
}
