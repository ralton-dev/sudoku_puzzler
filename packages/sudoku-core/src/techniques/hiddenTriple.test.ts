import { describe, expect, it } from 'vitest';
import { hiddenTriple } from './hiddenTriple.js';
import { hiddenPair } from './hiddenPair.js';
import { applyStep } from './state.js';
import { blank, rowOf, strip } from './sculpt.js';

describe('hiddenTriple', () => {
  it('strips the cover candidates off the three cells the triple is hiding in', () => {
    const state = strip(blank(), rowOf(0).slice(3), [1, 2, 3]);
    const step = hiddenTriple(state);
    expect(step).toMatchObject({
      technique: 'hiddenTriple',
      cells: [0, 1, 2],
      units: [0],
      placements: [],
    });
    expect(step?.eliminations).toEqual([
      { cell: 0, digits: [4, 5, 6, 7, 8, 9] },
      { cell: 1, digits: [4, 5, 6, 7, 8, 9] },
      { cell: 2, digits: [4, 5, 6, 7, 8, 9] },
    ]);
    expect(applyStep(state, step!)).toBe(18);
    expect(hiddenPair(state)).toBeNull();
  });

  it('finds nothing on an untouched board', () => {
    expect(hiddenTriple(blank())).toBeNull();
  });
});
