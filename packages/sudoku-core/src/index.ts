/**
 * The public surface of `sudoku-core`. Pure, dependency-free, 9x9 only
 * (decisions 1 and 3).
 *
 * WP-A froze these signatures and left every body throwing `NotImplemented`.
 * Each stub names the work package that replaces it; that package deletes the
 * stub in the same commit it lands the implementation (decision 13) and turns
 * its export line into a re-export from the real file.
 *
 *   WP-B  landed — solve, countSolutions, isValidGrid, isComplete are real
 *         (grid.ts, solver.ts), and their stubs are gone
 *   WP-C  landed — generatePuzzle and GenerationFailed are real (generator.ts),
 *         and the stub and the class that lived here are gone
 *   WP-D  landed — generate and rate are real (level.ts, rater.ts), and with
 *         them the last stub went, so `NotImplemented` is gone too
 *
 * Every export below is now a re-export of a real implementation; nothing here
 * throws.
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

// --- WP-B: grid.ts ------------------------------------------------------
// `isValidGrid` and `isComplete` are the two the plan names; the rest are the
// tables and helpers WP-C and WP-D build on. See grid.ts for the bitmask
// convention — digit `d` is bit `d - 1`, and `candidates` returns 0 for a
// filled cell.
export {
  ALL_DIGITS,
  BOXES,
  BOX_OF,
  COLS,
  COL_OF,
  PEERS,
  ROWS,
  ROW_OF,
  UNITS,
  UNITS_OF,
  bitFor,
  candidates,
  digitsOf,
  emptyGrid,
  formatGrid,
  isComplete,
  isValidGrid,
  lowestDigit,
  parseGrid,
  popcount,
} from './grid.js';

// --- WP-B: solver.ts ----------------------------------------------------
// `countSolutions(grid, 2) === 1` is the uniqueness proof of decision 5.
// `solveRandom` is how WP-C gets a full grid to dig from (decision 17).
export { countSolutions, solve, solveRandom } from './solver.js';

// --- WP-C: generator.ts -------------------------------------------------
// `generatePuzzle` returns a `GeneratedPuzzle` — `Puzzle` without `level`,
// because the band came from the caller and this package has no `levelOf`.
// WP-D's `generate({level, seed})` adds the level. `shuffleGrid` is the SOTD
// variant trick, exported because it is useful on its own.
export type { GeneratePuzzleOptions, GeneratedPuzzle, GenerationStats } from './generator.js';
export {
  DEFAULT_STEP_BACK_BUDGET,
  GenerationFailed,
  RATE_AFTER_REMOVALS,
  generatePuzzle,
  shuffleGrid,
} from './generator.js';

// --- WP-D: techniques/, rater.ts, level.ts ------------------------------
// `rate` is the decision-16 ladder; `levelOf` reads its score; `generate` digs
// a puzzle into a level's band. `createState`/`applyStep` are the candidate
// state techniques run on — WP-T1 rebuilds a stored position with
// `createState(grid, eliminated)` and re-runs one `TECHNIQUES[id]` against it.
export type { Technique, TechniqueState } from './techniques/index.js';
export { COSTS, LADDER, TECHNIQUES, applyStep, createState } from './techniques/index.js';
export { levelOf, rate } from './rater.js';
export { BANDS, generate } from './level.js';

// --- WP-T1: training/ ---------------------------------------------------
// The committed training positions (decision 18) and the names/costs the
// training UI labels them with. Data only — `examples.json` is mined offline by
// `training/mine.ts` and imported straight through the workspace by WP-T2, so
// there is no training API and no server change.
export * from './training/index.js';
