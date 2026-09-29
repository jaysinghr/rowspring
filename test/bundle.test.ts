import { describe, expect, test } from 'vitest';
import * as Rowspring from '../src/bundle';

describe('Apps Script bundle public API', () => {
  test('exposes core functions directly on the Rowspring namespace', () => {
    expect(Rowspring).toMatchObject({
      planSync: expect.any(Function),
      runChunk: expect.any(Function),
      applyPlan: expect.any(Function),
      readSheetRows: expect.any(Function),
      buildWriteback: expect.any(Function),
    });

    expect(Rowspring).not.toHaveProperty('Rowspring');
  });
});
