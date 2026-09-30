/**
 * Map over `items` with at most `limit` calls of `fn` in flight at once.
 * Results keep the input order. Rejects on the first failure, like
 * Promise.all. Used to stay clear of GitHub's secondary rate limits, which
 * punish bursts of concurrent requests.
 */
export async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  async function worker(): Promise<void> {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i] as T, i);
    }
  }

  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker);
  await Promise.all(workers);
  return results;
}
