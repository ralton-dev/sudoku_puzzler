import { describe, expect, it } from 'vitest';
import { nakedQuad } from './nakedQuad.js';
import { nakedTriple } from './nakedTriple.js';
import { applyStep } from './state.js';
import { blank, only, rowOf } from './sculpt.js';

describe('nakedQuad', () => {
  it('accepts members holding only two of the four digits ({12}{23}{34}{14})', () => {
    let state = blank();
    state = only(state, 0, [1, 2]);
    state = only(state, 1, [2, 3]);
    state = only(state, 2, [3, 4]);
    state = only(state, 3, [1, 4]);
    const step = nakedQuad(state);
    expect(step).toMatchObject({
      technique: 'nakedQuad',
      cells: [0, 1, 2, 3],
      units: [0],
      placements: [],
    });
    expect(step?.eliminations.map((e) => e.cell)).toEqual(rowOf(0).slice(4));
    expect(step?.eliminations.every((e) => e.digits.join() === '1,2,3,4')).toBe(true);
    expect(step?.reason).toContain('quad');
    // 5 remaining cells x 4 digits
    expect(applyStep(state, step!)).toBe(20);
    // and it is genuinely not a triple
    expect(nakedTriple(state)).toBeNull();
  });

  it('finds nothing on an untouched board', () => {
    expect(nakedQuad(blank())).toBeNull();
  });

  it('needs a fourth member — a bare triple is not a quad', () => {
    let state = blank();
    state = only(state, 0, [1, 2]);
    state = only(state, 1, [2, 3]);
    state = only(state, 2, [1, 3]);
    expect(nakedQuad(state)).toBeNull();
  });
});
