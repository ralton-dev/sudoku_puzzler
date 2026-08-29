import { describe, expect, it } from 'vitest';
import { hiddenSingle } from './hiddenSingle.js';
import { applyStep, stateFromString } from './state.js';
import { blank } from './sculpt.js';

/**
 * 5s at r1c4, r2c7, r6c1 and r8c2 leave both row 3 and box 1 exactly one square
 * for a 5 — r3c3 — while that square still holds other candidates, so the 5 is
 * hidden, not naked. Rows come before boxes in `UNITS`, so the documented scan
 * order says the step is reported against **row 3**, not box 1.
 */
function hiddenFive(): string {
  const cells = new Array(81).fill('0');
  for (const i of [3, 15, 45, 64]) cells[i] = '5';
  return cells.join('');
}

describe('hiddenSingle', () => {
  it('places a digit that has one square left in a unit', () => {
    const state = stateFromString(hiddenFive());
    const step = hiddenSingle(state);
    expect(step).toMatchObject({
      technique: 'hiddenSingle',
      cells: [20],
      units: [2],
      placements: [{ cell: 20, digit: 5 }],
      eliminations: [],
    });
    expect(step?.reason).toBe('r3c3 is the only square in row 3 that can still take a 5.');
    // hidden, not naked: the square has other candidates too
    expect(state.cand[20]).not.toBe(1 << 4);
    expect(applyStep(state, step!)).toBeGreaterThan(0);
  });

  it('finds nothing on a board where every digit has nine squares per unit', () => {
    expect(hiddenSingle(blank())).toBeNull();
  });
});
