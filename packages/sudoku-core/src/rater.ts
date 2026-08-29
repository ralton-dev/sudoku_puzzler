/**
 * The rater — decision 16's loop, and the `levelOf` that reads its score.
 *
 * ## The loop, exactly as decision 16 writes it
 *
 * "The rater applies techniques cheapest-first, restarting from the top after
 * every successful application; each application adds its cost; the sum is the
 * score."
 *
 * So: try `LADDER[0]`, then `LADDER[1]`, ... until one returns a `Step`; apply
 * it; add `COSTS[id][0]` if this is the technique's first use on this grid and
 * `COSTS[id][1]` otherwise; **start again from `LADDER[0]`**. Stop when the
 * board is complete (that sum is the score) or when no technique applies (the
 * ladder has stalled: return `null`, decision 16 — such a puzzle needs a guess,
 * has no score, and is never served).
 *
 * Restarting from the top is what makes the score meaningful: an expensive
 * technique is only ever charged when nothing cheaper was available at that
 * moment, so the sum measures how often the solver was forced up the ladder.
 * It is also what keeps the rater fast, because a restart almost always lands
 * on a naked single and never reaches the expensive scans at all — the costly
 * end of the ladder runs once per genuinely hard step, not once per placement.
 *
 * ## The infinite-loop guard
 *
 * A `Step` that changes nothing would leave the position identical and the loop
 * would return the same step forever. `applyStep` counts its changes and this
 * file **throws** on zero rather than spinning: a technique returning an empty
 * step is a bug in that technique, and every technique test asserts its step
 * changes something.
 *
 * A cell with no candidates left and no value is a dead position (contradictory
 * givens, or a grid with no solution); the ladder cannot proceed, so `rate`
 * returns `null` for it just as it does for a stall.
 *
 * `levelOf` and `SCORE_BANDS` live here rather than in `level.ts` because
 * `Rating.level` needs them and `level.ts` imports `rate`; keeping the
 * dependency one-way (`level.ts -> rater.ts`) avoids a cycle. `level.ts`
 * derives its generation `BANDS` from `SCORE_BANDS` so the two cannot drift.
 */

import type { Grid, Level, Rating, Step } from './types.js';
import { CELL_COUNT, LEVELS } from './types.js';
import { isValidGrid } from './grid.js';
import {
  COSTS,
  LADDER,
  TECHNIQUES,
  type TechniqueState,
  applyStep,
  createState,
} from './techniques/index.js';

/**
 * Decision 16's six bands, with the overlaps in sudokuoftheday.com's published
 * ranges "resolved by lower bound" so that `levelOf` is a total function:
 *
 *   beginner `< 4300` · easy `4300-5299` · medium `5300-6499` ·
 *   tricky `6500-8299` · fiendish `8300-10999` · diabolical `>= 11000`
 *
 * Exhaustive and open-ended at both ends, because `levelOf` must answer for any
 * score. The *generation* bands in `level.ts` close both ends; see `BANDS`.
 */
export const SCORE_BANDS: Readonly<Record<Level, { min: number; max: number }>> = {
  beginner: { min: 0, max: 4299 },
  easy: { min: 4300, max: 5299 },
  medium: { min: 5300, max: 6499 },
  tricky: { min: 6500, max: 8299 },
  fiendish: { min: 8300, max: 10999 },
  diabolical: { min: 11000, max: Number.POSITIVE_INFINITY },
};

/** The level a decision-16 score falls in. Total: every number has a level. */
export function levelOf(score: number): Level {
  for (const level of LEVELS) {
    if (score <= SCORE_BANDS[level].max) return level;
  }
  /* c8 ignore next -- diabolical's max is Infinity, so the loop always returns */
  return 'diabolical';
}

/**
 * Score `grid` by the decision-16 ladder using every technique in `LADDER`.
 *
 * Returns `null` when the ladder stalls before the grid is complete, when the
 * grid is not a legal position, or when it has run into a contradiction. With
 * WP-D's ten techniques a puzzle that needs Forcing Chains, a Quad or a
 * Swordfish stalls; WP-D2's four complete the ladder.
 *
 * `grid` is never mutated — the rater works on its own candidate state, which
 * is the point: techniques 3..10 produce eliminations with no placement, and
 * recomputing naive candidates would throw them away (see `techniques/state.ts`).
 */
export function rate(grid: Grid): Rating | null {
  if (!isValidGrid(grid)) return null;

  const state = createState(grid);
  const steps: Array<Step & { cost: number }> = [];
  const used = new Set<string>();
  let score = 0;
  let empty = 0;
  for (let i = 0; i < CELL_COUNT; i++) if ((grid[i] as number) === 0) empty++;

  while (empty > 0) {
    if (dead(state)) return null;

    let applied = false;
    for (const id of LADDER) {
      const step = TECHNIQUES[id](state);
      if (step === null) continue;

      const changed = applyStep(state, step);
      if (changed === 0) {
        throw new Error(
          `technique ${id} returned a step that changes nothing — that is a bug in ${id}.ts`,
        );
      }
      empty -= step.placements.length;

      const cost = COSTS[id][used.has(id) ? 1 : 0];
      used.add(id);
      score += cost;
      steps.push({ ...step, cost });
      applied = true;
      break;
    }
    if (!applied) return null; // the ladder stalled: no score (decision 16)
  }

  return { score, level: levelOf(score), steps };
}

/** True when some empty cell has no candidate left — the position is dead. */
function dead(state: TechniqueState): boolean {
  for (let i = 0; i < CELL_COUNT; i++) {
    if ((state.grid[i] as number) === 0 && (state.cand[i] as number) === 0) return true;
  }
  return false;
}
