import { absolute, formatDecimal, multiply, parseDecimal } from '../domain/decimal.js';

function safeNotional(qty, price) {
  if (!price) return null;
  try { return formatDecimal(multiply(absolute(parseDecimal(qty)), parseDecimal(price))); } catch { return null; }
}

export class PublicReadModel {
  constructor({ config, store, now = Date.now }) { this.config = config; this.store = store; this.now = now; }
  market() {
    const { market } = this.store.snapshot();
    const timestamps = [market.spot.receivedAt, market.futures.receivedAt].filter(Boolean);
    const latest = timestamps.length ? Math.min(...timestamps) : null;
    const stale = !latest || this.now() - latest > this.config.marketStaleMs;
    let spread = null;
    if (market.spot.ask && market.futures.bid) {
      try { spread = formatDecimal(parseDecimal(market.futures.bid) - parseDecimal(market.spot.ask)); } catch { /* invalid exchange value */ }
    }
    return { ...market, spread, stale, observedAt: this.now() };
  }
  status() {
    const state = this.store.snapshot(); const market = this.market();
    const target = -multiply(parseDecimal(state.spotNetQty), parseDecimal(this.config.hedgeRatio));
    const delta = target - parseDecimal(state.futuresConfirmedQty);
    const futuresPrice = delta > 0n ? market.futures.ask : market.futures.bid;
    return {
      mode: state.mode,
      dryRun: true,
      canTrade: false,
      protected: state.mode !== 'running' || market.stale,
      manualInterventionRequired: state.manualInterventionRequired,
      protectionReason: state.protectionReason ?? (market.stale ? 'market data stale' : null),
      privateConnected: state.privateConnected,
      publicConnected: state.publicConnected,
      marketSession: market.session,
      lastRecoveryAt: state.lastRecoveryAt,
      lastError: state.lastError,
      spotFilledGrossNetQty: state.spotNetQty,
      futuresConfirmedQty: state.futuresConfirmedQty,
      deltaQty: formatDecimal(absolute(delta)),
      unhedgedNotionalUsdt: safeNotional(formatDecimal(delta), futuresPrice)
    };
  }
  events(limit = 30) {
    const state = this.store.snapshot();
    return { items: state.events.slice(0, Math.max(1, Math.min(limit, 100))), count: state.events.length };
  }
}
