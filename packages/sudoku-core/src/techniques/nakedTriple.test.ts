import { describe, expect, it } from 'vitest';
import { nakedTriple } from './nakedTriple.js';
import { nakedPair } from './nakedPair.js';
import { applyStep } from './state.js';
import { blank, only, rowOf } from './sculpt.js';

describe('nakedTriple', () => {
  it('accepts members holding only two of the three digits (SOTD {24}{47}{27})', () => {
    let state = blank();
    state = only(state, 0, [1, 2]);
    state = only(state, 1, [2, 3]);
    state = only(state, 2, [1, 3]);
    const step = nakedTriple(state);
    expect(step).toMatchObject({
      technique: 'nakedTriple',
      cells: [0, 1, 2],
      units: [0],
      placements: [],
    });
    expect(step?.eliminations.map((e) => e.cell)).toEqual(rowOf(0).slice(3));
    expect(step?.eliminations.every((e) => e.digits.join() === '1,2,3')).toBe(true);
    expect(applyStep(state, step!)).toBe(18);
    // and it is genuinely not a pair
    expect(nakedPair(state)).toBeNull();
  });

  it('finds nothing on an untouched board', () => {
    expect(nakedTriple(blank())).toBeNull();
  });

  it('needs the three cells to share only three digits', () => {
    let state = blank();
    state = only(state, 0, [1, 2]);
    state = only(state, 1, [2, 3]);
    state = only(state, 2, [3, 4]);
    expect(nakedTriple(state)).toBeNull();
  });
});
