// Phase 1 intentionally exposes no live place-order implementation.
export class DryRunExchangeAdapter {
  constructor(store) { this.store = store; }
  async submit(intentId) {
    return this.store.transaction(state => {
      const intent = state.intents.find(item => item.id === intentId);
      if (!intent) throw new Error('persisted intent required');
      if (!intent.dryRun) throw new Error('live orders are disabled');
      intent.status = 'DRY_RUN_ACK'; intent.acknowledgedAt = new Date().toISOString();
      return { accepted: false, dryRun: true, clientOid: intent.clientOid };
    });
  }
}
