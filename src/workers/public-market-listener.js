export class PublicMarketListener {
  constructor({ store, clock = () => new Date() }) { Object.assign(this, { store, clock }); }
  async ingestTicker(product, ticker) {
    if (!['spot', 'futures'].includes(product) || !valid(ticker.bid) || !valid(ticker.ask)) throw new Error('invalid public ticker');
    await this.store.transaction(state => {
      state.market[product] = { bid: String(ticker.bid), ask: String(ticker.ask), exchangeTimestamp: ticker.timestamp };
      state.market.updatedAt = this.clock().toISOString(); state.market.stale = false;
    });
  }
  async ingestSession(session) {
    if (!['pre_market', 'regular', 'after_hours', 'overnight', 'closed'].includes(session.phase) || !session.exchangeTimezone) throw new Error('invalid market session');
    await this.store.transaction(state => { state.session = { phase: session.phase, exchangeTimezone: session.exchangeTimezone, isMarketOpenNow: session.phase !== 'closed', exchangeTimestamp: session.timestamp, localTimestamp: this.clock().toISOString(), taipeiTimestamp: new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', dateStyle: 'medium', timeStyle: 'medium' }).format(this.clock()) }; });
  }
  async markStale() { await this.store.transaction(state => { state.market.stale = true; }); }
}
function valid(value) { return /^\d+(\.\d+)?$/.test(String(value)); }
