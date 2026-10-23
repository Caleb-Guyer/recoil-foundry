export class BoundedCache<K, V> {
  private values = new Map<K, V>();
  private limit: number;
  private release: (value: V) => void;
  constructor(limit: number, release: (value: V) => void) {
    if (!Number.isInteger(limit) || limit < 1) throw new Error('Invalid cache capacity');
    this.limit = limit;
    this.release = release;
  }
  get size() {
    return this.values.size;
  }
  get(key: K): V | undefined {
    const value = this.values.get(key);
    if (value !== undefined) {
      this.values.delete(key);
      this.values.set(key, value);
    }
    return value;
  }
  set(key: K, value: V) {
    const old = this.values.get(key);
    if (old !== undefined && old !== value) this.release(old);
    this.values.delete(key);
    this.values.set(key, value);
    if (this.values.size > this.limit) {
      const oldest = this.values.keys().next().value!;
      const evicted = this.values.get(oldest)!;
      this.values.delete(oldest);
      this.release(evicted);
    }
  }
}
