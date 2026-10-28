// Holds the edit document and its undo history.
//
// `set` changes the live state without touching history, which is what sliders
// and drags do on every frame. `commit` turns the pending change into a single
// undo step once the interaction is over.

export class Store {
  #listeners = new Set();

  constructor(initial, { limit = 100 } = {}) {
    this.limit = limit;
    this.reset(initial);
  }

  get canUndo() {
    return this.past.length > 0 || this.state !== this.committed;
  }

  get canRedo() {
    return this.future.length > 0;
  }

  get dirty() {
    return this.canUndo;
  }

  subscribe(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  reset(state) {
    this.state = state;
    this.committed = state;
    this.past = [];
    this.future = [];
    this.#emit();
  }

  set(next) {
    if (next === this.state) return;
    this.state = next;
    this.#emit();
  }

  update(fn) {
    this.set(fn(this.state));
  }

  commit() {
    if (this.state === this.committed) return false;
    this.past.push(this.committed);
    if (this.past.length > this.limit) this.past.shift();
    this.committed = this.state;
    this.future = [];
    this.#emit();
    return true;
  }

  undo() {
    this.commit();
    if (!this.past.length) return;
    this.future.push(this.committed);
    this.state = this.committed = this.past.pop();
    this.#emit();
  }

  redo() {
    if (!this.future.length) return;
    this.past.push(this.committed);
    this.state = this.committed = this.future.pop();
    this.#emit();
  }

  #emit() {
    for (const listener of this.#listeners) listener(this.state);
  }
}
