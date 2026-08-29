import { describe, expect, it } from 'vitest';
import { candidateLines } from './candidateLines.js';
import { applyStep } from './state.js';
import { blank, colOf, strip } from './sculpt.js';

describe('candidateLines', () => {
  it('points a box-confined digit down its line and clears the rest of it', () => {
    // In box 1 the 1s can only be r1c1, r2c1, r3c1 — all column 1.
    const state = strip(blank(), [1, 2, 10, 11, 19, 20], [1]);
    const step = candidateLines(state);
    expect(step).toMatchObject({
      technique: 'candidateLines',
      cells: [0, 9, 18],
      units: [18, 9],
      placements: [],
    });
    expect(step?.eliminations.map((e) => e.cell)).toEqual(colOf(0).slice(3));
    expect(step?.eliminations.every((e) => e.digits.length === 1 && e.digits[0] === 1)).toBe(true);
    expect(step?.reason).toContain('column 1');
    expect(applyStep(state, step!)).toBe(6);
  });

  it('finds nothing when no box confines a digit to one line', () => {
    expect(candidateLines(blank())).toBeNull();
  });

  it('ignores a box with a single place for the digit — that is a hiddenSingle', () => {
    const state = strip(blank(), [1, 2, 9, 10, 11, 18, 19, 20], [1]);
    expect(candidateLines(state)).toBeNull();
  });
});
