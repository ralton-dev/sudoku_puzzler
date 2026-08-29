import { describe, expect, it } from 'vitest';
import { hiddenPair } from './hiddenPair.js';
import { applyStep } from './state.js';
import { blank, rowOf, strip } from './sculpt.js';

describe('hiddenPair', () => {
  it('strips the cover candidates off the two cells the pair is hiding in', () => {
    // 1 and 2 can only go in r1c1 and r1c2, behind seven other candidates each.
    const state = strip(blank(), rowOf(0).slice(2), [1, 2]);
    const step = hiddenPair(state);
    expect(step).toMatchObject({
      technique: 'hiddenPair',
      cells: [0, 1],
      units: [0],
      placements: [],
    });
    expect(step?.eliminations).toEqual([
      { cell: 0, digits: [3, 4, 5, 6, 7, 8, 9] },
      { cell: 1, digits: [3, 4, 5, 6, 7, 8, 9] },
    ]);
    expect(step?.reason).toBe(
      'In row 1 the digits 1 and 2 can only go in r1c1 and r1c2, so that pair fills those cells ' +
        'and every other candidate there can go.',
    );
    expect(applyStep(state, step!)).toBe(14);
  });

  it('finds nothing on an untouched board', () => {
    expect(hiddenPair(blank())).toBeNull();
  });
});
