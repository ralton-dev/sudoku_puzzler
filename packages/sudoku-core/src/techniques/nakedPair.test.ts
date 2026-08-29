import { describe, expect, it } from 'vitest';
import { nakedPair } from './nakedPair.js';
import { applyStep } from './state.js';
import { blank, only, rowOf } from './sculpt.js';

describe('nakedPair', () => {
  it('gives the pair its two digits and takes them off the rest of the unit', () => {
    const state = only(only(blank(), 0, [1, 2]), 1, [1, 2]);
    const step = nakedPair(state);
    expect(step).toMatchObject({
      technique: 'nakedPair',
      cells: [0, 1],
      units: [0],
      placements: [],
    });
    expect(step?.eliminations.map((e) => e.cell)).toEqual(rowOf(0).slice(2));
    expect(step?.eliminations.every((e) => e.digits.join() === '1,2')).toBe(true);
    expect(step?.reason).toBe(
      'r1c1 and r1c2 in row 1 hold nothing but 1 and 2 between them, so that pair owns those ' +
        'digits and they come out of the rest of row 1.',
    );
    expect(applyStep(state, step!)).toBe(14);
  });

  it('finds nothing on an untouched board', () => {
    expect(nakedPair(blank())).toBeNull();
  });

  it('needs the two cells to hold the same two digits, not merely two digits each', () => {
    const state = only(only(blank(), 0, [1, 2]), 1, [2, 3]);
    expect(nakedPair(state)).toBeNull();
  });
});
