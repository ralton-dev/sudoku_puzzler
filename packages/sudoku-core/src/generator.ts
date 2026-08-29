/**
 * Reductive generation with the difficulty targeted while digging — decision 17,
 * from sudokuoftheday.com/creation. Pure and dependency-free (decision 3): the
 * only randomness is the injected seeded `Rng`, and the only knowledge of
 * *difficulty* is the `rate` callback the caller passes in. This file has never
 * heard of a technique.
 *
 * ## The shape of a generation
 *
 *   1. `solveRandom(emptyGrid(), rng)` — a full board, varied by the seed.
 *   2. `shuffleGrid` — the SOTD variant trick (band-preserving row/column
 *      permutations, band/stack permutations, an optional transpose, a digit
 *      relabelling). All of it maps a valid board to a valid board, so two seeds
 *      diverge for the price of 81 array writes rather than a second search.
 *   3. Dig: remove rotationally-symmetric **pairs** `{i, 80 - i}` (the centre,
 *      cell 40, is its own partner and goes alone) in a random order. Every
 *      removal must keep `countSolutions(g, 2) === 1` (decision 5). From the
 *      16th removal on, the grid is also rated: a removal that makes the ladder
 *      stall (`rate` returns `null`) or overshoots `target.max` is reverted.
 *      The first grid whose score reaches `target.min` is the puzzle.
 *
 * ## Step-backs, and what happens when a dig pass runs dry
 *
 * A reverted removal is a **step-back**. There are only 41 symmetric groups, so
 * a single pass can never spend the default budget of 300 — and re-trying a
 * group that already failed is pointless, because removals only ever make a
 * grid emptier: what broke uniqueness once breaks it again, and a score that
 * overshot only climbs. So when a pass reaches the end of its group order
 * without landing in the band, **that is not a separate failure mode — the pass
 * is abandoned and a fresh dig pass starts from the same full grid with a new
 * random group order**, its step-backs added to the running total. Only when
 * the total reaches `stepBackBudget` does `generatePuzzle` throw
 * `GenerationFailed`. That is what makes decision 17's "discard the whole grid
 * after a step-back budget and start again" a real budget: the caller (WP-D's
 * `level.ts`) discards this seed and retries with `seed + 1`.
 *
 * A pass that somehow took no step-backs still counts as one, so the loop
 * cannot spin forever on a degenerate rater.
 */

import { CELL_COUNT, type Grid, type Rating } from './types.js';
import { createRng, type Rng, shuffle } from './rng.js';
import { emptyGrid } from './grid.js';
import { countSolutions, solveRandom } from './solver.js';

/** Reverted removals allowed before a seed is given up on (decision 17). */
export const DEFAULT_STEP_BACK_BUDGET = 300;

/**
 * How many removals happen on uniqueness alone before the rater joins in
 * (decision 17's "after ~15 pairs"). Rating a 70-given grid is wasted work: no
 * such grid is anywhere near a target band, and with the real rater every call
 * runs the whole ladder.
 */
export const RATE_AFTER_REMOVALS = 15;

/**
 * Thrown by `generatePuzzle` when the step-back budget is spent (decision 17).
 * `stepBacks` is what was actually spent, which is the budget or a little over.
 */
export class GenerationFailed extends Error {
  readonly seed: number;
  readonly stepBacks: number;

  constructor(detail: { seed: number; stepBacks: number }) {
    super(`generation failed for seed ${detail.seed} after ${detail.stepBacks} step-backs`);
    this.name = 'GenerationFailed';
    this.seed = detail.seed;
    this.stepBacks = detail.stepBacks;
  }
}

/** Options for `generatePuzzle` (decision 17). */
export interface GeneratePuzzleOptions {
  seed: number;
  /** the score band to land in, inclusive at both ends */
  target: { min: number; max: number };
  /** injected rater — `null` means the ladder stalled on this grid */
  rate: (grid: Grid) => Rating | null;
  /** how many reverted removals before the seed is given up on; default 300 */
  stepBackBudget?: number;
}

/** What a generation cost — the numbers WP-D and WP-G budget against. */
export interface GenerationStats {
  /** reverted removals, summed over every dig pass */
  stepBacks: number;
  /** calls made to the injected `rate`, including the reverted ones */
  rateCalls: number;
  /** symmetric groups actually removed in the winning pass (40 pairs + centre) */
  removals: number;
  /** dig passes started; > 1 means an earlier pass ran out of removable cells */
  passes: number;
}

/**
 * A generated puzzle: `Puzzle` (types.ts) minus `level`, plus what it cost.
 *
 * The level is deliberately absent — this file has no `levelOf`, and the band
 * came from the caller. WP-D's `generate({level, seed})` wraps this into a
 * `Puzzle` by adding the level it asked for. `rating` is the injected rater's
 * own verdict on `givens`, trace and all.
 */
export interface GeneratedPuzzle {
  /** the clues, exactly one solution (decision 5) */
  givens: Grid;
  /** the full board `givens` was dug out of */
  solution: Grid;
  /** the seed the whole generation is a function of (decision 3) */
  seed: number;
  /** `rating.score`, hoisted for convenience */
  score: number;
  /** whatever the injected rater said about `givens` */
  rating: Rating;
  stats: GenerationStats;
}

// --- shuffleGrid ---------------------------------------------------------

/**
 * A permutation of 0..8 that keeps each band (or stack) intact: the three
 * bands are reordered, and the three lines inside each band are reordered.
 * Applied to rows and columns this is a sudoku symmetry — it maps a valid board
 * to a valid board — which is the whole point of the trick.
 */
function bandedOrder(rng: Rng): number[] {
  const order: number[] = [];
  for (const band of shuffle([0, 1, 2], rng)) {
    for (const line of shuffle([0, 1, 2], rng)) order.push(band * 3 + line);
  }
  return order;
}

/**
 * SOTD's variant trick: rows within bands, columns within stacks, the bands and
 * stacks themselves, an optional transpose, and a relabelling of the nine
 * digits — every one of them a symmetry of sudoku, so a complete valid grid
 * stays complete and valid and a puzzle stays a puzzle with the same solution
 * count. Zeros are carried through untouched, so this works on a partial grid
 * as well as a full one.
 *
 * `rng` is advanced by exactly nine draws' worth of shuffling; pass the same
 * generator the dig uses and the whole generation stays one function of the seed.
 */
export function shuffleGrid(grid: Grid, rng: Rng): Grid {
  const rowOrder = bandedOrder(rng);
  const colOrder = bandedOrder(rng);
  const transposed = rng() < 0.5;
  const relabel = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], rng);

  const out = new Uint8Array(CELL_COUNT);
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const value = grid[(rowOrder[r] as number) * 9 + (colOrder[c] as number)] as number;
      const target = transposed ? c * 9 + r : r * 9 + c;
      out[target] = value === 0 ? 0 : (relabel[value - 1] as number);
    }
  }
  return out;
}

// --- the dig -------------------------------------------------------------

/**
 * The 41 rotationally-symmetric removal groups: `{i, 80 - i}` for the 40 pairs,
 * and `[40]` for the centre cell, which is its own 180-degree partner
 * (decision 17). Built once; `generatePuzzle` shuffles a copy of the outer
 * array and never mutates a group.
 */
const SYMMETRIC_GROUPS: readonly (readonly number[])[] = (() => {
  const groups: number[][] = [];
  for (let i = 0; i < 40; i++) groups.push([i, 80 - i]);
  groups.push([40]);
  return groups;
})();

/**
 * Dig a full grid down to a puzzle whose rating lands inside `target`
 * (decision 17). Deterministic: the same options give the same puzzle, because
 * the only randomness is `createRng(seed)`.
 *
 * Throws `GenerationFailed` when the step-back budget is spent — including when
 * dig passes keep running out of removable cells short of the band (see the
 * file header). The caller retries with another seed.
 */
export function generatePuzzle(options: GeneratePuzzleOptions): GeneratedPuzzle {
  const { seed, target, rate } = options;
  const stepBackBudget = options.stepBackBudget ?? DEFAULT_STEP_BACK_BUDGET;
  const rng = createRng(seed);

  const full = solveRandom(emptyGrid(), rng);
  /* c8 ignore next 3 -- the empty grid always completes; this is a type guard */
  if (full === null) {
    throw new Error('unreachable: the empty grid always has a solution');
  }
  const solution = shuffleGrid(full, rng);

  let stepBacks = 0;
  let rateCalls = 0;
  let passes = 0;

  while (stepBacks < stepBackBudget) {
    passes++;
    const order = shuffle([...SYMMETRIC_GROUPS], rng);
    const grid = Uint8Array.from(solution);
    let removals = 0;
    let passStepBacks = 0;

    for (const group of order) {
      if (stepBacks >= stepBackBudget) break;

      const saved = group.map((cell) => grid[cell] as number);
      for (const cell of group) grid[cell] = 0;

      let keep = countSolutions(grid, 2) === 1; // decision 5, on every removal
      let rating: Rating | null = null;
      if (keep && removals >= RATE_AFTER_REMOVALS) {
        rateCalls++;
        rating = rate(grid);
        if (rating === null || rating.score > target.max) keep = false;
      }

      if (!keep) {
        for (let k = 0; k < group.length; k++) grid[group[k] as number] = saved[k] as number;
        stepBacks++;
        passStepBacks++;
        continue;
      }

      removals++;
      if (rating !== null && rating.score >= target.min) {
        return {
          givens: grid,
          solution,
          seed,
          score: rating.score,
          rating,
          stats: { stepBacks, rateCalls, removals, passes },
        };
      }
    }

    // A pass that ran dry costs at least one step-back, so the budget is always
    // reached and the loop always terminates.
    if (passStepBacks === 0) stepBacks++;
  }

  throw new GenerationFailed({ seed, stepBacks });
}
