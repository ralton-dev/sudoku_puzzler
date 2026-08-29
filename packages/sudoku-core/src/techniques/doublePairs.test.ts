import { describe, expect, it } from 'vitest';
import { doublePairs } from './doublePairs.js';
import { multipleLines } from './multipleLines.js';
import { applyStep } from './state.js';
import { blank, strip } from './sculpt.js';

/**
 * Band 0, digit 1. Box 2's 1s are the pair r1c4/r2c4 and box 3's are the pair
 * r1c7/r2c7 — two pairs, both spanning rows 1 and 2 — so box 1 must take its 1
 * on row 3 and the 1s come out of box 1's rows 1 and 2.
 */
function twoPairs() {
  return strip(blank(), [4, 5, 13, 14, 21, 22, 23, 7, 8, 16, 17, 24, 25, 26], [1]);
}

describe('doublePairs', () => {
  it('uses two pairs in two boxes of a band to clear the third box', () => {
    const state = twoPairs();
    const step = doublePairs(state);
    expect(step).toMatchObject({
      technique: 'doublePairs',
      cells: [3, 6, 12, 15],
      placements: [],
    });
    expect(step?.units).toEqual([18 + 1, 18 + 2, 18 + 0, 0, 1]);
    expect(step?.eliminations.map((e) => e.cell)).toEqual([0, 1, 2, 9, 10, 11]);
    expect(step?.reason).toContain('row 3');
    expect(applyStep(state, step!)).toBe(6);
  });

  it('finds nothing on an untouched board', () => {
    expect(doublePairs(blank())).toBeNull();
  });

  it('declines the looser Multiple Lines shape (three candidates in one box)', () => {
    // box 2 now has 1s at r1c4, r1c5 and r2c4 — no longer a pair.
    const state = strip(blank(), [5, 13, 14, 21, 22, 23, 7, 8, 16, 17, 24, 25, 26], [1]);
    expect(doublePairs(state)).toBeNull();
    expect(multipleLines(state)).not.toBeNull();
  });
});
