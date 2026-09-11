import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { initialState } from '../domain/state.js';

export class FileStore {
  #state; #queue = Promise.resolve();
  constructor(path) { this.path = path; }
  async init() { try { this.#state = JSON.parse(await readFile(this.path, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; this.#state = initialState(); await this.#save(); } return this.snapshot(); }
  snapshot() { return structuredClone(this.#state); }
  transaction(update) { this.#queue = this.#queue.then(async () => { const draft = this.snapshot(); const result = await update(draft); this.#state = draft; await this.#save(); return result; }); return this.#queue; }
  async #save() { await mkdir(dirname(this.path), { recursive: true }); const temporary = `${this.path}.tmp`; await writeFile(temporary, `${JSON.stringify(this.#state, null, 2)}\n`, { mode: 0o600 }); await rename(temporary, this.path); }
}

export class MemoryStore {
  #state = initialState();
  snapshot() { return structuredClone(this.#state); }
  async init() { return this.snapshot(); }
  async transaction(update) { const draft = this.snapshot(); const result = await update(draft); this.#state = draft; return result; }
}
