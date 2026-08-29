import { describe, expect, it } from 'vitest';
import { xWing } from './xWing.js';
import { applyStep } from './state.js';
import { blank, colOf, rowOf, strip } from './sculpt.js';

describe('xWing', () => {
  it('finds the row-based wing and clears the two columns', () => {
    // 1s in rows 1 and 5 sit only in columns 1 and 5.
    let state = strip(
      blank(),
      rowOf(0).filter((c) => c !== 0 && c !== 4),
      [1],
    );
    state = strip(
      state,
      rowOf(4).filter((c) => c !== 36 && c !== 40),
      [1],
    );
    const step = xWing(state);
    expect(step).toMatchObject({
      technique: 'xWing',
      cells: [0, 4, 36, 40],
      units: [0, 4, 9, 13],
      placements: [],
    });
    expect(step?.eliminations.map((e) => e.cell)).toEqual([
      9, 13, 18, 22, 27, 31, 45, 49, 54, 58, 63, 67, 72, 76,
    ]);
    expect(step?.reason).toContain('column 1');
    expect(applyStep(state, step!)).toBe(14);
  });

  it('finds the column-based wing too, and only after trying rows', () => {
    let state = strip(
      blank(),
      colOf(0).filter((c) => c !== 0 && c !== 36),
      [2],
    );
    state = strip(
      state,
      colOf(4).filter((c) => c !== 4 && c !== 40),
      [2],
    );
    const step = xWing(state);
    expect(step).toMatchObject({ technique: 'xWing', cells: [0, 4, 36, 40], units: [9, 13, 0, 4] });
    expect(step?.eliminations).toHaveLength(14);
    expect(applyStep(state, step!)).toBe(14);
  });

  it('finds nothing on an untouched board', () => {
    expect(xWing(blank())).toBeNull();
  });
});
