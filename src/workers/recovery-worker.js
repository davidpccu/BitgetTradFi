export class RecoveryWorker {
  constructor({ config, store, alerts, now = Date.now }) {
    this.config = config; this.store = store; this.alerts = alerts; this.now = now; this.lastAlertSignature = '';
  }

  async run() {
    const before = this.store.snapshot();
    const reasons = [];
    if (!this.config.apiKey || !this.config.apiSecret || !this.config.apiPassphrase) reasons.push('private credentials missing');
    if (!before.privateConnected) reasons.push('private WS not authenticated');
    if (!before.publicConnected) reasons.push('public market WS not connected');
    if (before.manualInterventionRequired) reasons.push(before.protectionReason ?? 'manual intervention required');

    const next = await this.store.update((state) => {
      state.lastRecoveryAt = this.now();
      if (reasons.length) {
        state.mode = 'recovery'; state.protectionReason = reasons.join('; ');
      } else {
        // Phase 1 skeleton: connection readiness only. REST orders/fills/position reconciliation is a Phase 2 gate.
        state.mode = 'running'; state.protectionReason = null; state.lastError = null;
      }
    });
    const signature = reasons.join('; ');
    if (reasons.length && signature !== this.lastAlertSignature) await this.alerts.send(`RECOVERY pending: ${signature}`);
    this.lastAlertSignature = signature;
    return { ready: reasons.length === 0, reasons, state: next };
  }
}
