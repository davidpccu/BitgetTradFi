import { abs, add, compare, floorToStep, multiply, negate, subtract } from './decimal.js';
import { createHash } from 'node:crypto';

export class HedgeCoordinator {
  constructor({ store, config, notifier, clock = () => new Date() }) { Object.assign(this, { store, config, notifier, clock }); }
  async onSpotEvent(event) {
    if (!isFill(event)) return { ignored: 'ACK_NOT_FILL' };
    if (event.symbol !== this.config.spotSymbol || event.product !== 'spot' || event.source !== 'manual') return { ignored: 'NOT_MANUAL_TARGET_SPOT' };
    const notifications = [];
    const result = await this.store.transaction(state => {
      const incrementalQty = getIncrement(state, event);
      if (compare(incrementalQty, '0') === 0) return { duplicate: true };
      const signed = event.side === 'buy' ? incrementalQty : negate(incrementalQty);
      state.spotFilledSignedQty = add(state.spotFilledSignedQty, signed); // gross base quantity; fees intentionally excluded
      state.fills.push({ tradeId: event.tradeId || null, orderRef: mask(event.orderId), side: event.side, grossBaseQty: incrementalQty, at: event.timestamp });
      if (event.tradeId) state.processedTradeIds.push(event.tradeId);
      state.events.unshift({ type: 'spot_fill', side: event.side, qty: incrementalQty, at: event.timestamp }); state.events = state.events.slice(0, 100);
      if (state.mode === 'PAUSED') { notifications.push(alert('paused_fill', this.config.spotSymbol, incrementalQty)); return { ignored: 'PAUSED_FILL_RECORDED' }; }
      const target = negate(multiply(state.spotFilledSignedQty, this.config.hedgeRatio));
      const working = state.intents.filter(i => ['READY', 'DRY_RUN_ACK'].includes(i.status)).reduce((sum, i) => add(sum, i.signedQty), '0');
      const delta = subtract(subtract(target, state.futuresHedgedSignedQty), working);
      const quantized = floorToStep(abs(delta), this.config.qtyStep);
      if (compare(quantized, this.config.minQty) < 0) return { residual: abs(delta) };
      const signedQty = compare(delta, '0') < 0 ? negate(quantized) : quantized;
      const id = stableId(event, signedQty); const existing = state.intents.find(i => i.id === id);
      if (existing) return { intent: existing, duplicate: true };
      const intent = { id, clientOid: `HEDGE_DRY_${id}`, symbol: this.config.futuresSymbol, side: compare(signedQty, '0') < 0 ? 'sell' : 'buy', qty: abs(signedQty), signedQty, orderType: 'market', status: 'READY', dryRun: true, createdAt: this.clock().toISOString() };
      state.intents.push(intent); state.events.unshift({ type: 'hedge_intent', side: intent.side, qty: intent.qty, at: intent.createdAt });
      return { intent };
    });
    await Promise.all(notifications.map(n => this.notifier.send(n)));
    return result;
  }
  async onFuturesEvent(event) {
    if (!isFill(event) || event.product !== 'futures') return { ignored: 'ACK_NOT_FILL' };
    return this.store.transaction(state => {
      if (event.tradeId && state.processedTradeIds.includes(`f:${event.tradeId}`)) return { duplicate: true };
      const signed = event.side === 'buy' ? event.fillQty : negate(event.fillQty);
      state.futuresHedgedSignedQty = add(state.futuresHedgedSignedQty, signed);
      if (event.tradeId) state.processedTradeIds.push(`f:${event.tradeId}`);
      return { applied: signed };
    });
  }
}
function isFill(e) { return e.type === 'fill' && compare(e.fillQty || '0', '0') > 0; }
function getIncrement(state, e) { if (e.tradeId) return state.processedTradeIds.includes(e.tradeId) ? '0' : e.fillQty; const old = state.orderHighWater[e.orderId] || '0'; if (compare(e.cumFillQty, old) < 0) throw new Error('cumulative fill regressed; recovery required'); const delta = subtract(e.cumFillQty, old); state.orderHighWater[e.orderId] = e.cumFillQty; return delta; }
function stableId(event, qty) { return createHash('sha256').update(`${event.tradeId || event.orderId}:${event.cumFillQty || event.fillQty}:${qty}`).digest('hex').slice(0, 20); }
function mask(value = '') { return value.length < 8 ? '***' : `${value.slice(0, 3)}…${value.slice(-3)}`; }
function alert(eventType, symbol, deltaQty) { return { time: new Date().toISOString(), symbol, eventType, impactNotionalUsdt: 'unknown', deltaQty, suggestedAction: 'review manual fill while paused' }; }
