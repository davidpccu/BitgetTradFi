import { EventEmitter } from 'node:events';

// Transport-neutral listener. A production Bitget socket may feed raw messages into ingest();
// keeping credentials and exchange contract details outside the public server boundary.
export class PrivateFillListener extends EventEmitter {
  constructor({ coordinator, notifier, config }) { super(); Object.assign(this, { coordinator, notifier, config }); this.connected = false; }
  async ingest(raw) {
    const events = normalize(raw);
    const results = [];
    for (const event of events) results.push(event.product === 'spot' ? await this.coordinator.onSpotEvent(event) : await this.coordinator.onFuturesEvent(event));
    return results;
  }
  connectedNow() { this.connected = true; this.emit('connected'); }
  async disconnected(reason = 'unknown') {
    this.connected = false;
    this.emit('disconnected', reason);
    await this.notifier.send({ time: new Date().toISOString(), symbol: this.config.spotSymbol, eventType: 'private_ws_disconnected', impactNotionalUsdt: 'unknown', deltaQty: 'unknown', suggestedAction: 'verify connectivity and run REST backfill' });
  }
}

export function normalize(raw) {
  if (!raw || !Array.isArray(raw.data)) throw new Error('private event data must be an array');
  return raw.data.map(item => {
    const product = item.product === 'spot' ? 'spot' : item.product === 'futures' ? 'futures' : null;
    const status = String(item.status || '').toLowerCase();
    const fillQty = String(item.fillQty || '0');
    if (!product || !['buy', 'sell'].includes(item.side) || !item.symbol || !/^\d+(\.\d+)?$/.test(fillQty)) throw new Error('invalid private event schema');
    if (fillQty !== '0' && !item.tradeId && item.cumFillQty == null) throw new Error('fill requires tradeId or cumulative quantity');
    return { type: ['filled', 'partial_fill', 'partial-filled'].includes(status) && fillQty !== '0' ? 'fill' : 'ack', product, source: item.source || 'unknown', symbol: item.symbol, side: item.side, fillQty, cumFillQty: item.cumFillQty == null ? null : String(item.cumFillQty), tradeId: item.tradeId ? String(item.tradeId) : null, orderId: String(item.orderId || ''), timestamp: item.timestamp || new Date().toISOString() };
  });
}
