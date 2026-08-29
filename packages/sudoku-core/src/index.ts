/**
 * The public surface of `sudoku-core`. Pure, dependency-free, 9x9 only
 * (decisions 1 and 3).
 *
 * WP-A froze these signatures and left every body throwing `NotImplemented`.
 * Each stub names the work package that replaces it; that package deletes the
 * stub in the same commit it lands the implementation (decision 13) and turns
 * its export line into a re-export from the real file.
 *
 *   WP-B  solve, countSolutions, isValidGrid, isComplete   (grid.ts, solver.ts)
 *   WP-C  generatePuzzle, GenerationFailed                 (generator.ts)
 *   WP-D  generate, rate                                   (rater.ts, level.ts)
 *
 * When the last stub goes, `NotImplemented` below goes with it.
 */

export type {
  Elimination,
  Grid,
  Level,
  Placement,
  Puzzle,
  Rating,
  Step,
  TechniqueId,
  TrainingExample,
} from './types.js';
export { CELL_COUNT, LEVELS, TECHNIQUE_IDS } from './types.js';
export type { Rng } from './rng.js';
export { createRng, randomInt, shuffle } from './rng.js';

import type { Grid, Level, Puzzle, Rating } from './types.js';

/**
 * Thrown by a WP-A stub. The message names the package that owes the
 * implementation, so a wave-2 failure reads as "not yet" rather than "broken".
 */
export class NotImplemented extends Error {
  readonly workPackage: string;

  constructor(workPackage: string, symbol: string, ..._args: unknown[]) {
    super(`${symbol}() is not implemented yet — ${workPackage} lands it.`);
    this.name = 'NotImplemented';
    this.workPackage = workPackage;
  }
}

/** Thrown by `generatePuzzle` when the step-back budget is spent (decision 17). */
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
  /** the score band to land in, inclusive */
  target: { min: number; max: number };
  /** injected rater — `null` means the ladder stalled on this grid */
  rate: (grid: Grid) => Rating | null;
  /** how many reverted removals before the whole grid is discarded; default 300 */
  stepBackBudget?: number;
}

// --- WP-B ---------------------------------------------------------------

/** The one solution of `grid`, or `null` if it has none (or is invalid). */
export function solve(grid: Grid): Grid | null {
  throw new NotImplemented('WP-B', 'solve', grid);
}

/** How many solutions `grid` has, counting no further than `limit`. */
export function countSolutions(grid: Grid, limit: number): number {
  throw new NotImplemented('WP-B', 'countSolutions', grid, limit);
}

/** True when no digit repeats in any row, column or box. Zeros are ignored. */
export function isValidGrid(grid: Grid): boolean {
  throw new NotImplemented('WP-B', 'isValidGrid', grid);
}

/** True when `grid` is valid and has no empty cell. */
export function isComplete(grid: Grid): boolean {
  throw new NotImplemented('WP-B', 'isComplete', grid);
}

// --- WP-C ---------------------------------------------------------------

/**
 * Dig a full grid down to a puzzle whose rating lands inside `target`
 * (decision 17). The rater is injected, so this function knows nothing about
 * techniques. Throws `GenerationFailed` when the step-back budget is spent.
 */
export function generatePuzzle(options: GeneratePuzzleOptions): Puzzle {
  throw new NotImplemented('WP-C', 'generatePuzzle', options);
}

// --- WP-D ---------------------------------------------------------------

/**
 * Score `grid` by the decision-16 ladder. `null` when the ladder stalls — such
 * a puzzle has no score and is never served.
 */
export function rate(grid: Grid): Rating | null {
  throw new NotImplemented('WP-D', 'rate', grid);
}

/** A puzzle with exactly one solution, rated at `level` (decisions 4 and 5). */
export function generate(options: { level: Level; seed: number }): Puzzle {
  throw new NotImplemented('WP-D', 'generate', options);
}
