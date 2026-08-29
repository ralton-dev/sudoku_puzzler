import { describe, expect, it } from 'vitest';
import { LEVELS, type Level } from './types.js';
import { countSolutions } from './solver.js';
import { formatGrid } from './grid.js';
import { SCORE_BANDS, rate } from './rater.js';
import { BANDS, MAX_GRIDS, generate } from './level.js';

/**
 * ## Grids per level and wall time, seed 1
 *
 * Measured on this Mac, node 22. "grids" is how many seeds `generate` spent
 * before one landed in the band — `MAX_GRIDS` (20) is the give-up point.
 *
 * | level      | grids | clues | score | wall time |
 * | ---------- | ----- | ----- | ----- | --------- |
 * | beginner   |     1 |    44 |  3700 |      3 ms |
 * | easy       |     1 |    38 |  4300 |      3 ms |
 * | medium     |     1 |    27 |  5400 |     17 ms |
 * | tricky     |     3 |    28 |  6550 |    396 ms |
 * | fiendish   |     1 |    30 |  8500 |     78 ms |
 * | diabolical |     7 |    24 | 11450 |   1077 ms |
 *
 * **All six levels are reachable with techniques 1..10.** WP-D's brief expected
 * `fiendish` and `diabolical` to be out of reach until WP-D2 landed techniques
 * 11..14, and they are not: the decision-16 score is *cumulative*, so a
 * 24-clue board racks up 5700 from singles alone before a single Candidate
 * Lines is charged, and a handful of mid-ladder steps carry it past 11000. What
 * WP-D2 changes is not reachability but *character* — with Forcing Chains, the
 * Quads and the Swordfish available, `rate` will finish puzzles that stall
 * today (the diabolical fixture is one), and the digger will reach the same
 * bands from harder positions rather than from long cheap ones.
 *
 * The whole suite below runs in under 2 s, so nothing is skipped and nothing is
 * marked expected-to-fail. `diabolical` at 1.1 s is the one to watch: it is
 * comfortably inside WP-G's 3 s pre-generation threshold, but it is the number
 * that decides whether the server needs a puzzle pool.
 */
const GENERATION_TIMEOUT_MS = 60_000;

describe('BANDS', () => {
  it('is decision 16’s table with only the two open ends closed', () => {
    for (const level of LEVELS) {
      const band = BANDS[level];
      const classified = SCORE_BANDS[level];
      expect(band.max).toBe(level === 'diabolical' ? 25000 : classified.max);
      expect(band.min).toBe(level === 'beginner' ? 3600 : classified.min);
      expect(band.min).toBeLessThan(band.max);
    }
  });

  it('targets a band that classifies back to the level it belongs to', () => {
    for (const level of LEVELS) {
      expect(SCORE_BANDS[level].min).toBeLessThanOrEqual(BANDS[level].min);
      expect(SCORE_BANDS[level].max).toBeGreaterThanOrEqual(BANDS[level].max);
    }
  });

  it('gives up after 20 grids', () => {
    expect(MAX_GRIDS).toBe(20);
  });
});

describe('generate', () => {
  for (const level of LEVELS) {
    it(
      `produces a unique puzzle rated ${level}`,
      () => {
        const puzzle = generate({ level, seed: 1 });
        expect(puzzle.level).toBe(level);
        expect(countSolutions(puzzle.givens, 2)).toBe(1); // decision 5
        const rating = rate(puzzle.givens);
        expect(rating).not.toBeNull();
        expect(rating?.level).toBe(level);
        expect(rating?.score).toBeGreaterThanOrEqual(BANDS[level].min);
        expect(rating?.score).toBeLessThanOrEqual(BANDS[level].max);
        // the givens really are a subset of the solution they were dug from
        for (let i = 0; i < 81; i++) {
          const given = puzzle.givens[i] as number;
          if (given !== 0) expect(given).toBe(puzzle.solution[i]);
        }
      },
      GENERATION_TIMEOUT_MS,
    );
  }

  it(
    'is deterministic — the same seed gives the same board (decision 3)',
    () => {
      const first = generate({ level: 'medium', seed: 7 });
      const second = generate({ level: 'medium', seed: 7 });
      expect(formatGrid(second.givens)).toBe(formatGrid(first.givens));
      expect(formatGrid(second.solution)).toBe(formatGrid(first.solution));
    },
    GENERATION_TIMEOUT_MS,
  );

  it(
    'reports the seed that actually produced the board, which reproduces it directly',
    () => {
      const puzzle = generate({ level: 'tricky', seed: 1 });
      const again = generate({ level: 'tricky', seed: puzzle.seed });
      expect(formatGrid(again.givens)).toBe(formatGrid(puzzle.givens));
      expect(again.seed).toBe(puzzle.seed);
    },
    GENERATION_TIMEOUT_MS,
  );

  it(
    'gives different seeds different boards',
    () => {
      const boards = new Set<string>();
      for (const seed of [1, 2, 3]) {
        boards.add(formatGrid(generate({ level: 'easy' satisfies Level, seed }).givens));
      }
      expect(boards.size).toBe(3);
    },
    GENERATION_TIMEOUT_MS,
  );
});
