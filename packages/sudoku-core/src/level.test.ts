import { describe, expect, it } from 'vitest';
import { LEVELS, type Level } from './types.js';
import { countSolutions } from './solver.js';
import { formatGrid } from './grid.js';
import { SCORE_BANDS, rate } from './rater.js';
import { BANDS, MAX_GRIDS, generate } from './level.js';

/**
 * ## Grids per level and wall time — WP-D2, the complete fourteen-rung ladder
 *
 * Measured on this Mac, node 22, seeds 1..5 per level. "grids" is how many
 * seeds `generate` spent before one landed in the band (`MAX_GRIDS` = 20 is the
 * give-up point); "score" and "clues" are the board seed 1 produced.
 *
 * | level      | grids 1..5    | worst ms | seed-1 clues | seed-1 score |
 * | ---------- | ------------- | -------- | ------------ | ------------ |
 * | beginner   | 1 1 1 1 1     |      8   |           44 |         3700 |
 * | easy       | 1 1 1 1 1     |      2   |           38 |         4300 |
 * | medium     | 1 1 1 1 1     |      7   |           27 |         5400 |
 * | tricky     | 3 2 1 1 1     |    210   |           28 |         6550 |
 * | fiendish   | 1 1 1 1 1     |     64   |           30 |         9550 |
 * | diabolical | 1 1 1 1 2     |    126   |           28 |        12350 |
 *
 * **Nothing is close to WP-G's 3 s pre-generation threshold.** The slowest
 * single call in the whole table is `tricky` seed 1 at 210 ms, and the two
 * levels WP-G was told to watch are the two that got *faster*: before WP-D2,
 * `diabolical` seed 1 spent 7 grids and 1077 ms and `fiendish` 78 ms. On these
 * numbers WP-G does not need a puzzle pool.
 *
 * ## What the four new rungs changed, and what they deliberately did not
 *
 * `beginner`, `easy`, `medium` and `tricky` are **byte-identical** to WP-D:
 * same grids tried, same clue counts, same scores, for all five seeds. Those
 * bands are reached long before the ladder ever climbs past X-Wing, so adding
 * rungs above it cannot move them.
 *
 * `fiendish` and `diabolical` changed character, exactly as WP-D's comment
 * predicted. A removal that used to make the ladder stall — and so used to be
 * reverted — now rates, because Forcing Chains finishes it. The digger
 * therefore digs deeper into the same grid instead of throwing it away: one
 * grid instead of seven for `diabolical`, and the boards it keeps are ones
 * whose rating genuinely uses technique 11 rather than long cheap ones that
 * merely accumulate singles. Seed-1 `fiendish` moved 8500 -> 9550 and
 * `diabolical` 11450 -> 12350 for that reason. Both still land in their band,
 * which is what `generate` guarantees and what the tests below assert.
 *
 * `nakedQuad`, `hiddenQuad` and `swordfish` fire on none of these thirty
 * boards, nor on any of the six fixtures — Forcing Chains gets there first
 * every time. They are on the ladder because decision 16 puts them there and
 * because a stall is the alternative, not because they are common.
 *
 * The whole suite below runs in well under 2 s; nothing is skipped and nothing
 * is marked expected-to-fail.
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
