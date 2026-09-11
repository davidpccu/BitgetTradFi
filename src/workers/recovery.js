export class RecoveryWorker {
  constructor({ store, readonlyExchange, notifier, config }) { Object.assign(this, { store, readonlyExchange, notifier, config }); }
  async run() {
    await this.store.transaction(state => { state.mode = 'RECOVERY'; state.protectedReason = 'reconciliation in progress'; });
    try {
      const snapshot = await this.readonlyExchange.reconcile();
      if (!snapshot.wsSubscribed || snapshot.hasGap || !snapshot.positionConsistent) throw new Error('reconciliation evidence is incomplete');
      await this.store.transaction(state => { state.mode = 'RUNNING'; state.protectedReason = null; state.lastReconciledAt = new Date().toISOString(); });
      return true;
    } catch (error) {
      await this.store.transaction(state => { state.mode = 'PROTECTED'; state.protectedReason = error.message; });
      await this.notifier.send({ time: new Date().toISOString(), symbol: this.config.futuresSymbol, eventType: 'protected_entered', impactNotionalUsdt: 'unknown', deltaQty: 'unknown', suggestedAction: 'complete REST/WS reconciliation before resuming' });
      return false;
    }
  }
}

// Fail-closed Phase 1 placeholder: no live credentials means reconciliation cannot be proven.
export class RecoverySkeletonAdapter {
  async reconcile() { return { wsSubscribed: false, hasGap: true, positionConsistent: false, openOrders: [], fills: [], position: null }; }
}
