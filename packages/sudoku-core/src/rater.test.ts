import { describe, expect, it } from 'vitest';
import { KNOWN_BY_LEVEL, KNOWN_PUZZLES } from './fixtures/known.js';
import { formatGrid, parseGrid } from './grid.js';
import { COSTS, LADDER } from './techniques/index.js';
import { SCORE_BANDS, levelOf, rate } from './rater.js';

/**
 * ## The six fixtures, end to end
 *
 * The score-against-SOTD table, the deltas and what they mean now live in
 * `calibration.test.ts` (WP-D2) — one place, measured once. What this file
 * keeps is the structural half: whatever the ladder decides, every step it
 * traces has to change something, read like a sentence, name a rung that is on
 * the ladder, and add up to the score by decision 16's cost table.
 *
 * All six rate. The `diabolical` fixture stalled here until WP-D2 landed
 * Forcing Chains; it no longer does, so the loop below has no special case.
 */
describe('rate — the six sudokuoftheday.com fixtures', () => {
  for (const fixture of KNOWN_PUZZLES) {
    const rating = rate(parseGrid(fixture.givens));

    it(`finishes the ${fixture.level} fixture without stalling`, () => {
      expect(rating).not.toBeNull();
      expect(rating?.steps.length).toBeGreaterThan(0);
    });

    it(`traces the ${fixture.level} fixture with steps that all change something`, () => {
      for (const step of rating?.steps ?? []) {
        expect(step.placements.length + step.eliminations.length).toBeGreaterThan(0);
        expect(step.reason.length).toBeGreaterThan(10);
        expect(LADDER).toContain(step.technique);
      }
    });

    it(`sums the ${fixture.level} fixture's score as first-use plus subsequent costs`, () => {
      const seen = new Set<string>();
      let expected = 0;
      for (const step of rating?.steps ?? []) {
        expected += COSTS[step.technique][seen.has(step.technique) ? 1 : 0];
        seen.add(step.technique);
      }
      expect(rating?.score).toBe(expected);
    });
  }
});

describe('rate', () => {
  it('never mutates the grid it is handed', () => {
    const grid = parseGrid(KNOWN_BY_LEVEL.beginner.givens);
    rate(grid);
    expect(formatGrid(grid)).toBe(KNOWN_BY_LEVEL.beginner.givens);
  });

  it('is deterministic', () => {
    const grid = parseGrid(KNOWN_BY_LEVEL.medium.givens);
    expect(rate(grid)).toEqual(rate(grid));
  });

  it('charges a technique its first-use cost once and its subsequent cost after', () => {
    // Two naked singles and nothing else: 100 + 100.
    const solution = KNOWN_BY_LEVEL.beginner.solution;
    const almost = `${solution.slice(0, 79)}00`;
    const rating = rate(parseGrid(almost));
    expect(rating?.steps.map((s) => [s.technique, s.cost])).toEqual([
      ['nakedSingle', COSTS.nakedSingle[0]],
      ['nakedSingle', COSTS.nakedSingle[1]],
    ]);
    expect(rating?.score).toBe(200);
  });

  it('scores a finished board 0 and calls it beginner', () => {
    const rating = rate(parseGrid(KNOWN_BY_LEVEL.beginner.solution));
    expect(rating).toEqual({ score: 0, level: 'beginner', steps: [] });
  });

  it('returns null for a grid that breaks the rules', () => {
    expect(rate(parseGrid(`11${'0'.repeat(79)}`))).toBeNull();
  });

  it('returns null for a legal grid with no solution', () => {
    // Legal as written — no digit repeats — but r1c9 needs a 9 that r2c9 blocks.
    expect(rate(parseGrid(`123456780000000009${'0'.repeat(63)}`))).toBeNull();
  });
});

describe('levelOf', () => {
  it('reads decision 16’s bands, overlaps resolved by lower bound', () => {
    expect(levelOf(0)).toBe('beginner');
    expect(levelOf(4299)).toBe('beginner');
    expect(levelOf(4300)).toBe('easy');
    expect(levelOf(5299)).toBe('easy');
    expect(levelOf(5300)).toBe('medium');
    expect(levelOf(6499)).toBe('medium');
    expect(levelOf(6500)).toBe('tricky');
    expect(levelOf(8299)).toBe('tricky');
    expect(levelOf(8300)).toBe('fiendish');
    expect(levelOf(10999)).toBe('fiendish');
    expect(levelOf(11000)).toBe('diabolical');
    expect(levelOf(1e9)).toBe('diabolical');
  });

  it('agrees with SCORE_BANDS at every boundary, and the bands are contiguous', () => {
    let previous = -1;
    for (const [level, band] of Object.entries(SCORE_BANDS)) {
      expect(band.min).toBe(previous + 1);
      expect(levelOf(band.min)).toBe(level);
      previous = band.max;
    }
    expect(previous).toBe(Number.POSITIVE_INFINITY);
  });
});
