import { createHmac } from 'node:crypto';
import { extractRows, normalizePrivateOrder } from '../domain/events.js';
import { NativeWebSocket } from './native-websocket.js';

export function privateLogin(config, now = Date.now()) {
  const timestamp = String(Math.floor(now / 1000));
  const sign = createHmac('sha256', config.apiSecret).update(`${timestamp}GET/user/verify`).digest('base64');
  return { op: 'login', args: [{ apiKey: config.apiKey, passphrase: config.apiPassphrase, timestamp, sign }] };
}

export class BitgetPrivateFillListener {
  constructor({ config, coordinator, store, alerts, socketFactory = () => new NativeWebSocket(), now = Date.now, timers = globalThis }) {
    this.config = config; this.coordinator = coordinator; this.store = store; this.alerts = alerts;
    this.socketFactory = socketFactory; this.now = now; this.timers = timers;
    this.socket = null; this.stopped = true; this.reconnectAttempt = 0; this.authenticated = false; this.heartbeat = null;
  }

  start() {
    this.stopped = false;
    if (!this.config.apiKey || !this.config.apiSecret || !this.config.apiPassphrase) {
      void this.#setDisconnected('private credentials missing');
      return;
    }
    this.#connect();
  }

  stop() { this.stopped = true; this.#stopHeartbeat(); this.socket?.close(); }

  #connect() {
    if (this.stopped) return;
    this.authenticated = false;
    const socket = this.socketFactory(); this.socket = socket;
    socket.on('open', () => {
      socket.sendText(JSON.stringify(privateLogin(this.config, this.now())));
      this.#stopHeartbeat();
      this.heartbeat = this.timers.setInterval(() => { try { socket.sendText('ping'); } catch { /* reconnect handles closure */ } }, 25_000);
    });
    socket.on('message', (text) => void this.#message(text));
    socket.on('error', (error) => void this.#setDisconnected(`private WS error: ${error.message}`));
    socket.on('close', () => {
      this.#stopHeartbeat();
      void this.#setDisconnected('private WS disconnected');
      if (!this.stopped) {
        const delay = Math.min(30_000, 1_000 * (2 ** Math.min(this.reconnectAttempt++, 5)));
        this.timers.setTimeout(() => this.#connect(), delay);
      }
    });
    socket.connect(this.config.privateWsUrl);
  }

  #stopHeartbeat() { if (this.heartbeat) this.timers.clearInterval(this.heartbeat); this.heartbeat = null; }

  async #message(text) {
    if (text === 'pong') return;
    let message;
    try { message = JSON.parse(text); } catch { await this.#setDisconnected('invalid private WS JSON'); return; }
    if (message.event === 'login') {
      if (String(message.code ?? '0') !== '0') { await this.#setDisconnected(`private login rejected: ${message.code ?? 'unknown'}`); return; }
      this.authenticated = true; this.reconnectAttempt = 0;
      this.socket.sendText(JSON.stringify({ op: 'subscribe', args: this.config.privateSubscriptions }));
      await this.store.update((state) => { state.privateConnected = true; state.lastError = null; });
      return;
    }
    for (const row of extractRows(message)) {
      try {
        const event = normalizePrivateOrder({ ...(message.arg ?? {}), ...row }, this.config, this.now());
        await this.coordinator.handle(event);
      } catch (error) {
        await this.#setDisconnected(`private fill processing failed: ${error.message}`);
      }
    }
  }

  async #setDisconnected(reason) {
    await this.store.update((state) => {
      state.privateConnected = false; state.mode = 'recovery'; state.protectionReason = reason; state.lastError = reason;
    });
    await this.alerts.send(`RECOVERY: ${reason}`);
  }
}
