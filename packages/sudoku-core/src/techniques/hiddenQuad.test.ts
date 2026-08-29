import { describe, expect, it } from 'vitest';
import { hiddenQuad } from './hiddenQuad.js';
import { hiddenTriple } from './hiddenTriple.js';
import { applyStep } from './state.js';
import { blank, rowOf, strip } from './sculpt.js';

describe('hiddenQuad', () => {
  it('frees four cells that four digits are confined to', () => {
    // 1, 2, 3 and 4 can only go in r1c1..r1c4, hidden behind 5..9 there.
    const state = strip(blank(), rowOf(0).slice(4), [1, 2, 3, 4]);
    const step = hiddenQuad(state);
    expect(step).toMatchObject({
      technique: 'hiddenQuad',
      cells: [0, 1, 2, 3],
      units: [0],
      placements: [],
    });
    expect(step?.eliminations.map((e) => e.cell)).toEqual([0, 1, 2, 3]);
    expect(step?.eliminations.every((e) => e.digits.join() === '5,6,7,8,9')).toBe(true);
    expect(step?.reason).toContain('quad');
    // 4 cells x 5 candidates removed
    expect(applyStep(state, step!)).toBe(20);
  });

  it('finds nothing on an untouched board', () => {
    expect(hiddenQuad(blank())).toBeNull();
  });

  it('needs a fourth digit — a hidden triple is not a quad', () => {
    const state = strip(blank(), rowOf(0).slice(3), [1, 2, 3]);
    expect(hiddenTriple(state)).not.toBeNull();
    expect(hiddenQuad(state)).toBeNull();
  });
});
