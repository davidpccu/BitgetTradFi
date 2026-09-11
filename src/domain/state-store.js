import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export function initialState(now = Date.now()) {
  return {
    version: 1,
    mode: 'recovery',
    protectionReason: 'startup reconciliation pending',
    manualInterventionRequired: false,
    lastError: null,
    lastRecoveryAt: null,
    privateConnected: false,
    publicConnected: false,
    spotNetQty: '0',
    simulatedRequestedQty: '0',
    futuresConfirmedQty: '0',
    processedTradeIds: [],
    orderCumulative: {},
    intents: [],
    events: [],
    market: {
      spot: { bid: null, ask: null, exchangeTime: null, receivedAt: null },
      futures: { bid: null, ask: null, exchangeTime: null, receivedAt: null },
      session: { status: 'unknown', source: 'not-reported', updatedAt: now }
    }
  };
}

export class StateStore {
  #state;
  #file;
  #queue = Promise.resolve();
  constructor(file = '', now = Date.now()) { this.#file = file; this.#state = initialState(now); }
  async load() {
    if (!this.#file) return this.snapshot();
    try { this.#state = { ...initialState(), ...JSON.parse(await readFile(this.#file, 'utf8')) }; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    return this.snapshot();
  }
  snapshot() { return structuredClone(this.#state); }
  update(mutator) {
    const operation = this.#queue.then(async () => {
      const next = structuredClone(this.#state);
      await mutator(next);
      this.#state = next;
      if (this.#file) {
        await mkdir(dirname(this.#file), { recursive: true });
        const temp = `${this.#file}.${process.pid}.tmp`;
        await writeFile(temp, `${JSON.stringify(next)}\n`, { mode: 0o600 });
        await rename(temp, this.#file);
      }
      return this.snapshot();
    });
    this.#queue = operation.catch(() => {});
    return operation;
  }
}
