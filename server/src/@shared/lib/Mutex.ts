/**
 * Runs async work one at a time, in call order.
 * Node is single-threaded, but two requests can still interleave across `await`s.
 */
export class Mutex {
  private tail: Promise<unknown> = Promise.resolve();

  run<T>(work: () => Promise<T>): Promise<T> {
    const result = this.tail.then(work);
    this.tail = result.catch(() => undefined);
    return result;
  }
}
