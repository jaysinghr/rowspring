export interface RunChunkOptions<T> {
  items: T[];
  startIndex: number;
  timeBudgetMs: number;
  now: () => number;
  processOne: (item: T) => void;
}

export interface RunChunkResult {
  done: boolean;
  nextIndex: number;
  processedCount: number;
}

export function runChunk<T>(options: RunChunkOptions<T>): RunChunkResult {
  const { items, startIndex, timeBudgetMs, now, processOne } = options;
  const startedAt = now();
  let processedCount = 0;
  let i = startIndex;

  for (; i < items.length; i++) {
    if (now() - startedAt >= timeBudgetMs) {
      return { done: false, nextIndex: i, processedCount };
    }
    const item = items[i];
    if (item === undefined) continue;
    processOne(item);
    processedCount++;
  }

  return { done: true, nextIndex: items.length, processedCount };
}
