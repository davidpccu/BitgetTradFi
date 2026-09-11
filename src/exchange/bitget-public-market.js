import { extractRows } from '../domain/events.js';
import { NativeWebSocket } from './native-websocket.js';

function first(row, names) {
  for (const name of names) if (row[name] !== undefined && row[name] !== '') return row[name];
  return null;
}

export class BitgetPublicMarketListener {
  constructor({ config, store, alerts, socketFactory = () => new NativeWebSocket(), now = Date.now, timers = globalThis }) {
    this.config = config; this.store = store; this.alerts = alerts; this.socketFactory = socketFactory;
    this.now = now; this.timers = timers; this.socket = null; this.stopped = true; this.attempt = 0; this.heartbeat = null;
  }
  start() { this.stopped = false; this.#connect(); }
  stop() { this.stopped = true; this.#stopHeartbeat(); this.socket?.close(); }
  #connect() {
    if (this.stopped) return;
    const socket = this.socketFactory(); this.socket = socket;
    socket.on('open', () => {
      this.attempt = 0;
      socket.sendText(JSON.stringify({ op: 'subscribe', args: this.config.publicSubscriptions }));
      this.#stopHeartbeat();
      this.heartbeat = this.timers.setInterval(() => { try { socket.sendText('ping'); } catch { /* reconnect handles closure */ } }, 25_000);
      void this.store.update((state) => { state.publicConnected = true; });
    });
    socket.on('message', (text) => void this.#message(text));
    socket.on('error', (error) => void this.#down(`public WS error: ${error.message}`));
    socket.on('close', () => {
      this.#stopHeartbeat();
      void this.#down('public WS disconnected');
      if (!this.stopped) this.timers.setTimeout(() => this.#connect(), Math.min(30_000, 1_000 * (2 ** Math.min(this.attempt++, 5))));
    });
    socket.connect(this.config.publicWsUrl);
  }
  #stopHeartbeat() { if (this.heartbeat) this.timers.clearInterval(this.heartbeat); this.heartbeat = null; }
  async #message(text) {
    if (text === 'pong') return;
    let message; try { message = JSON.parse(text); } catch { return; }
    const argument = message.arg ?? {};
    for (const row of extractRows(message)) {
      const symbol = String(first(row, ['symbol', 'instId']) ?? argument.instId ?? '').toUpperCase();
      const bid = first(row, ['bidPr', 'bid1Price', 'bestBid', 'bid']);
      const ask = first(row, ['askPr', 'ask1Price', 'bestAsk', 'ask']);
      const exchangeTime = Number(first(row, ['ts', 'timestamp', 'uTime']) ?? message.ts ?? this.now());
      const sessionValue = first(row, ['marketStatus', 'marketState', 'session', 'tradeStatus']);
      await this.store.update((state) => {
        const target = symbol === this.config.spotSymbol ? state.market.spot : symbol === this.config.futuresSymbol ? state.market.futures : null;
        if (target && bid !== null && ask !== null) Object.assign(target, { bid: String(bid), ask: String(ask), exchangeTime, receivedAt: this.now() });
        if (symbol === this.config.spotSymbol && sessionValue !== null) {
          state.market.session = { status: String(sessionValue).toLowerCase(), source: 'bitget-ticker', updatedAt: this.now() };
        }
      });
    }
  }
  async #down(reason) {
    await this.store.update((state) => { state.publicConnected = false; state.lastError = reason; });
  }
}
