// One request per optional feature. Failed requests can be retried; failed or
// abandoned menu opens never turn a late response into a new active view.
export class LazyResource<T> {
  value: T | undefined;
  private pending: Promise<T> | undefined;
  private readonly fetch: () => Promise<T>;
  constructor(fetch: () => Promise<T>) {
    this.fetch = fetch;
  }
  load(): Promise<T> {
    if (this.value !== undefined) return Promise.resolve(this.value);
    return (this.pending ??= Promise.resolve()
      .then(this.fetch)
      .then((value) => (this.value = value))
      .finally(() => {
        this.pending = undefined;
      }));
  }
}

export class ViewLifetime {
  private revision = 0;
  invalidate() {
    this.revision++;
  }
  ticket() {
    const revision = this.revision;
    return () => this.revision === revision;
  }
}
