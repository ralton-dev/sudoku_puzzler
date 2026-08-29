/**
 * Level targeting: the score band each level is generated into, and the public
 * `generate({level, seed})` that wraps WP-C's reductive digger around WP-D's
 * rater.
 *
 * ## `BANDS` vs `SCORE_BANDS`
 *
 * `SCORE_BANDS` (rater.ts) is decision 16's *classification* — exhaustive and
 * open at both ends, because `levelOf` must answer for any score. `BANDS` is
 * the *generation target*, so both ends have to be real numbers the digger can
 * compare against, and two of the twelve bounds are therefore chosen here
 * rather than read off decision 16:
 *
 *  - **`beginner.min = 3600`.** Decision 16 only says "beginner `< 4300`". With
 *    a floor of 0 the digger would stop at its very first rated grid — a
 *    fifty-clue board that is not a puzzle. 3600 is sudokuoftheday.com's own
 *    published lower bound for beginner (their range is 3600-4500), so the
 *    floor comes from the same source as everything else in decision 16.
 *  - **`diabolical.max = 25000`.** Decision 16 quotes SOTD's diabolical range
 *    as 11000-25000 and then leaves our band open-ended at `>= 11000`. A
 *    generation ceiling has to be finite or nothing is ever rejected for being
 *    too hard, so we take SOTD's own top of range, 25000. It is deliberately
 *    generous: nothing this ladder can rate comes close to it, and the effect
 *    of the cap is only ever to stop the digger accepting a freak grid.
 *
 * Every other bound is decision 16's, and `bandsMatchDecision16` in
 * `level.test.ts` asserts that mechanically against `SCORE_BANDS`.
 *
 * ## What `generate` actually does
 *
 * `generatePuzzle` (WP-C) digs one full grid and throws `GenerationFailed` when
 * its step-back budget is spent. That is a per-seed failure, not a per-level
 * one, so `generate` retries with `seed + 1`, `seed + 2`, ... up to
 * `MAX_GRIDS` (20) grids before giving up. The returned `Puzzle.seed` is the
 * seed that actually produced the board, not the one asked for, so
 * `generate({level, seed: p.seed})` reproduces it in one attempt.
 *
 * Determinism (decision 3) holds either way: `generate` is a pure function of
 * `{level, seed}`.
 */

import type { Level, Puzzle } from './types.js';
import { GenerationFailed, generatePuzzle } from './generator.js';
import { SCORE_BANDS, rate } from './rater.js';

/** Grids tried before `generate` gives up on a level. */
export const MAX_GRIDS = 20;

/**
 * The score band `generate` digs towards for each level, inclusive at both
 * ends. Decision 16's bounds, closed at the two open ends — see the file header
 * for why 3600 and 25000.
 */
export const BANDS: Readonly<Record<Level, { min: number; max: number }>> = {
  beginner: { min: 3600, max: SCORE_BANDS.beginner.max },
  easy: { min: SCORE_BANDS.easy.min, max: SCORE_BANDS.easy.max },
  medium: { min: SCORE_BANDS.medium.min, max: SCORE_BANDS.medium.max },
  tricky: { min: SCORE_BANDS.tricky.min, max: SCORE_BANDS.tricky.max },
  fiendish: { min: SCORE_BANDS.fiendish.min, max: SCORE_BANDS.fiendish.max },
  diabolical: { min: SCORE_BANDS.diabolical.min, max: 25000 },
};

/**
 * A puzzle with exactly one solution (decision 5), rated at `level`
 * (decisions 4 and 16).
 *
 * Throws `GenerationFailed` when `MAX_GRIDS` seeds in a row spend their
 * step-back budget without landing in the band — which is what happens when a
 * level is out of reach of the current ladder rather than merely unlucky.
 */
export function generate(options: { level: Level; seed: number }): Puzzle {
  const { level, seed } = options;
  const target = BANDS[level];
  let stepBacks = 0;

  for (let i = 0; i < MAX_GRIDS; i++) {
    try {
      const dug = generatePuzzle({ seed: seed + i, target, rate });
      return { givens: dug.givens, solution: dug.solution, level, seed: dug.seed };
    } catch (error) {
      if (!(error instanceof GenerationFailed)) throw error;
      stepBacks += error.stepBacks;
    }
  }
  throw new GenerationFailed({ seed, stepBacks });
}
