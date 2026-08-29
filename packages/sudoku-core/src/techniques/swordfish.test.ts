import { describe, expect, it } from 'vitest';
import { swordfish } from './swordfish.js';
import { xWing } from './xWing.js';
import { applyStep } from './state.js';
import { blank, colOf, rowOf, strip } from './sculpt.js';

/** Keep `digit` in `keep` only, within `line`. */
const confine = (state: ReturnType<typeof blank>, line: number[], keep: number[], digit: number) =>
  strip(
    state,
    line.filter((c) => !keep.includes(c)),
    [digit],
  );

describe('swordfish', () => {
  it('finds the row-based fish and clears the three columns', () => {
    // 3s in rows 1, 4 and 7 sit only in columns 1, 5 and 9.
    let state = confine(blank(), rowOf(0), [0, 4, 8], 3);
    state = confine(state, rowOf(3), [27, 31, 35], 3);
    state = confine(state, rowOf(6), [54, 58, 62], 3);

    const step = swordfish(state);
    expect(step).toMatchObject({
      technique: 'swordfish',
      cells: [0, 4, 8, 27, 31, 35, 54, 58, 62],
      units: [0, 3, 6, 9, 13, 17],
      placements: [],
    });
    // three columns of nine, less the nine corners
    expect(step?.eliminations).toHaveLength(18);
    expect(step?.eliminations.every((e) => e.digits.join() === '3')).toBe(true);
    expect(step?.reason).toContain('row 1');
    expect(step?.reason).toContain('column 9');
    expect(applyStep(state, step!)).toBe(18);
  });

  it('finds the column-based fish too, and only after trying rows', () => {
    let state = confine(blank(), colOf(0), [0, 36, 72], 4);
    state = confine(state, colOf(4), [4, 40, 76], 4);
    state = confine(state, colOf(8), [8, 44, 80], 4);

    const step = swordfish(state);
    expect(step).toMatchObject({
      technique: 'swordfish',
      cells: [0, 4, 8, 36, 40, 44, 72, 76, 80],
      units: [9, 13, 17, 0, 4, 8],
    });
    expect(step?.eliminations).toHaveLength(18);
    expect(applyStep(state, step!)).toBe(18);
  });

  it('takes a base line with only two places — SOTD’s "6 (or more)"', () => {
    let state = confine(blank(), rowOf(0), [0, 4], 5); // two places
    state = confine(state, rowOf(3), [27, 31, 35], 5);
    state = confine(state, rowOf(6), [54, 58, 62], 5);

    const step = swordfish(state);
    expect(step?.cells).toEqual([0, 4, 27, 31, 35, 54, 58, 62]);
    // 27 cells in the three columns, less the 8 corners and less r1c9, which the
    // sculpting already stripped the 5 from.
    expect(step?.eliminations).toHaveLength(18);
  });

  it('finds nothing on an untouched board', () => {
    expect(swordfish(blank())).toBeNull();
  });

  it('does not call an X-wing a swordfish — three base lines are required', () => {
    let state = confine(blank(), rowOf(0), [0, 4], 6);
    state = confine(state, rowOf(4), [36, 40], 6);
    expect(xWing(state)).not.toBeNull();
    expect(swordfish(state)).toBeNull();
  });
});
