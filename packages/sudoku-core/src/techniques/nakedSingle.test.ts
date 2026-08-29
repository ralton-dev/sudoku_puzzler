import { describe, expect, it } from 'vitest';
import { nakedSingle } from './nakedSingle.js';
import { applyStep, eliminate, stateFromString } from './state.js';
import { blank } from './sculpt.js';

describe('nakedSingle', () => {
  it('places the digit when a cell has one candidate left', () => {
    // Row 1 holds 1..8, so r1c9 can only be 9.
    const state = stateFromString('12345678'.padEnd(9, '0').padEnd(81, '0'));
    const step = nakedSingle(state);
    expect(step).not.toBeNull();
    expect(step).toMatchObject({
      technique: 'nakedSingle',
      cells: [8],
      units: [0, 17, 18 + 2],
      placements: [{ cell: 8, digit: 9 }],
      eliminations: [],
    });
    expect(step?.reason).toBe('r1c9 has only one candidate left, so it must be 9.');
    expect(applyStep(state, step!)).toBeGreaterThan(0);
  });

  it('finds nothing on a board where every cell still has nine candidates', () => {
    expect(nakedSingle(blank())).toBeNull();
  });

  it('scans cells ascending, so the lowest index wins', () => {
    // Two naked singles: r1c9 (index 8) from the row, and index 80 sculpted.
    const state = stateFromString('12345678'.padEnd(9, '0').padEnd(81, '0'));
    eliminate(state, 80, [1, 2, 3, 4, 5, 6, 7, 8]);
    expect(nakedSingle(state)?.placements[0]?.cell).toBe(8);
  });
});
