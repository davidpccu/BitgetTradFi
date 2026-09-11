import { abs, multiply, subtract } from '../domain/decimal.js';

export function createReadModel(store) {
  return {
    market() { const { market } = store.snapshot(); return market; },
    status() { const s = store.snapshot(); return { status: s.mode.toLowerCase().replace('_', '-'), dryRun: true, canTrade: false, lastReconciledAt: s.lastReconciledAt, protectedReason: s.protectedReason, isMarketOpenNow: s.session.isMarketOpenNow, deltaQty: abs(subtract(multiply(s.spotFilledSignedQty, '-1'), s.futuresHedgedSignedQty)) }; },
    session() { return store.snapshot().session; },
    events() { return store.snapshot().events.slice(0, 50); }
  };
}
