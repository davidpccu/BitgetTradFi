export class TelegramNotifier {
  constructor({ token = '', chatId = '', fetchImpl = globalThis.fetch, logger = console }) { Object.assign(this, { token, chatId, fetchImpl, logger }); }
  async send(alert) {
    if (!this.token || !this.chatId) { this.logger.warn('TG_DISABLED', redact(alert)); return { delivered: false, reason: 'not_configured' }; }
    const text = Object.entries(alert).map(([key, value]) => `${key}: ${value}`).join('\n');
    try {
      const response = await this.fetchImpl(`https://api.telegram.org/bot${this.token}/sendMessage`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: this.chatId, text }), signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error(`Telegram HTTP ${response.status}`);
      return { delivered: true };
    } catch (error) { this.logger.error('TG_DELIVERY_FAILED', error.message); return { delivered: false, reason: 'delivery_failed' }; }
  }
}
function redact(value) { return JSON.stringify(value).replace(/(secret|token|passphrase|signature)[^,}]*/gi, '$1:[REDACTED]'); }
