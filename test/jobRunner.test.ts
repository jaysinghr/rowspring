import { describe, expect, test } from 'vitest';
import { runChunk } from '../src/core/jobRunner';

describe('runChunk', () => {
  test('processes every item when the time budget is not exceeded', () => {
    const processed: number[] = [];
    let elapsedMs = 0;

    const result = runChunk({
      items: [1, 2, 3],
      startIndex: 0,
      timeBudgetMs: 1000,
      now: () => elapsedMs,
      processOne: (item) => {
        processed.push(item);
        elapsedMs += 10;
      },
    });

    expect(processed).toEqual([1, 2, 3]);
    expect(result).toEqual({ done: true, nextIndex: 3, processedCount: 3 });
  });

  test('stops before the time budget runs out and reports where to resume', () => {
    const processed: number[] = [];
    let elapsedMs = 0;

    const result = runChunk({
      items: [1, 2, 3, 4, 5],
      startIndex: 0,
      timeBudgetMs: 15,
      now: () => elapsedMs,
      processOne: (item) => {
        processed.push(item);
        elapsedMs += 10;
      },
    });

    // Budget is 15ms, each item costs 10ms: item 1 runs (elapsed 10ms),
    // the check before item 2 sees 10ms spent (still under 15) so it runs
    // too (elapsed 20ms), the check before item 3 sees 20ms >= 15 and stops.
    expect(processed).toEqual([1, 2]);
    expect(result).toEqual({ done: false, nextIndex: 2, processedCount: 2 });
  });
});
