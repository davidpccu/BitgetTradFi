import https from 'node:https';

export class TelegramAlert {
  constructor({ token = '', chatId = '', logger = console }) { this.token = token; this.chatId = chatId; this.logger = logger; }
  async send(text) {
    const safeText = String(text).slice(0, 1000);
    if (!this.token || !this.chatId) {
      this.logger.info(`[alert:telegram-disabled] ${safeText}`);
      return { delivered: false, reason: 'not-configured' };
    }
    const body = JSON.stringify({ chat_id: this.chatId, text: safeText, disable_web_page_preview: true });
    return new Promise((resolve, reject) => {
      const request = https.request({
        hostname: 'api.telegram.org', path: `/bot${this.token}/sendMessage`, method: 'POST',
        headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) }, timeout: 5_000
      }, (response) => {
        response.resume();
        response.on('end', () => response.statusCode >= 200 && response.statusCode < 300
          ? resolve({ delivered: true }) : reject(new Error(`Telegram HTTP ${response.statusCode}`)));
      });
      request.on('timeout', () => request.destroy(new Error('Telegram timeout')));
      request.on('error', reject); request.end(body);
    }).catch((error) => {
      this.logger.error(`[alert:telegram-failed] ${error.message}`);
      return { delivered: false, reason: 'request-failed' };
    });
  }
}
