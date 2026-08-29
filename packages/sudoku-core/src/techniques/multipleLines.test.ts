import { describe, expect, it } from 'vitest';
import { multipleLines } from './multipleLines.js';
import { doublePairs } from './doublePairs.js';
import { applyStep } from './state.js';
import { blank, strip } from './sculpt.js';

/**
 * Band 0, digit 1. Every 1 in boxes 2 and 3 lies on row 1 or row 2 — three of
 * them in box 2, two in box 3, so it is not the Double Pairs shape — which
 * leaves box 1 only row 3 for its 1.
 */
function spread() {
  return strip(blank(), [5, 13, 14, 21, 22, 23, 7, 8, 16, 17, 24, 25, 26], [1]);
}

describe('multipleLines', () => {
  it('uses two boxes confined to two lines to clear the third box', () => {
    const state = spread();
    const step = multipleLines(state);
    expect(step).toMatchObject({
      technique: 'multipleLines',
      cells: [3, 4, 6, 12, 15],
      placements: [],
    });
    expect(step?.units).toEqual([18 + 1, 18 + 2, 18 + 0, 0, 1]);
    expect(step?.eliminations.map((e) => e.cell)).toEqual([0, 1, 2, 9, 10, 11]);
    expect(step?.reason).toContain('row 3');
    expect(applyStep(state, step!)).toBe(6);
  });

  it('finds nothing on an untouched board', () => {
    expect(multipleLines(blank())).toBeNull();
  });

  it('leaves the strict two-pairs shape to doublePairs', () => {
    const state = strip(blank(), [4, 5, 13, 14, 21, 22, 23, 7, 8, 16, 17, 24, 25, 26], [1]);
    expect(multipleLines(state)).toBeNull();
    expect(doublePairs(state)).not.toBeNull();
  });

  it('covers box/line reduction, which SOTD does not name separately', () => {
    // The only 1s in row 1 are in box 1, so boxes 2 and 3 are confined to rows
    // 2 and 3 — and box 1 must take its 1 on row 1.
    const state = strip(blank(), [3, 4, 5, 6, 7, 8], [1]);
    const step = multipleLines(state);
    expect(step?.eliminations.map((e) => e.cell)).toEqual([9, 10, 11, 18, 19, 20]);
  });
});
