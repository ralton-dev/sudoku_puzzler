/**
 * Bitmask backtracking with MRV cell choice — the library's only search.
 * Pure and dependency-free (decision 3): no timers, no `Math.random`, no Node
 * APIs. Randomness only ever arrives as an injected `Rng` (see `solveRandom`).
 *
 * ## How it works
 *
 * Three `Int32Array(9)` tables hold, per row / column / box, the bitmask of
 * digits already used in it (same convention as `grid.ts`: digit `d` is bit
 * `d - 1`). A cell's candidates are then one AND-NOT away, so no unit is ever
 * rescanned. On each step the search takes the empty cell with the **fewest**
 * candidates — minimum remaining values — which is what makes the 17-clue
 * "hardest for brute force" puzzles ordinary: a left-to-right search flounders
 * in a nearly-empty top-left corner, while MRV goes straight to the constrained
 * cells. A cell with zero candidates fails the branch immediately.
 *
 * `solve` and `countSolutions` never mutate the grid they are handed; they work
 * on a copy.
 */

import { ALL_DIGITS, BOX_OF, COL_OF, ROW_OF, digitsOf, popcount } from './grid.js';
import { type Rng, shuffle } from './rng.js';
import { CELL_COUNT, type Grid } from './types.js';

/** Working state: a grid copy plus the used-digit masks of every unit. */
interface Search {
  grid: Grid;
  rows: Int32Array;
  cols: Int32Array;
  boxes: Int32Array;
}

/** `selectCell` returns this when every cell is filled. */
const FULL = -1;
/** `selectCell` returns this when some empty cell has no candidate left. */
const DEAD = -2;

/**
 * Build the working state from `grid`, or return `null` when `grid` is not a
 * legal position — wrong length, a value outside 0..9, or a digit repeated in
 * some unit. Callers treat `null` as "no solutions", which is what an invalid
 * grid has.
 */
function begin(grid: Grid): Search | null {
  if (grid.length !== CELL_COUNT) return null;
  const state: Search = {
    grid: Uint8Array.from(grid),
    rows: new Int32Array(9),
    cols: new Int32Array(9),
    boxes: new Int32Array(9),
  };
  for (let i = 0; i < CELL_COUNT; i++) {
    const value = grid[i] as number;
    if (value === 0) continue;
    if (value > 9) return null;
    const bit = 1 << (value - 1);
    const r = ROW_OF[i] as number;
    const c = COL_OF[i] as number;
    const b = BOX_OF[i] as number;
    if (
      ((state.rows[r] as number) & bit) !== 0 ||
      ((state.cols[c] as number) & bit) !== 0 ||
      ((state.boxes[b] as number) & bit) !== 0
    ) {
      return null; // duplicate in a row, column or box
    }
    state.rows[r] = (state.rows[r] as number) | bit;
    state.cols[c] = (state.cols[c] as number) | bit;
    state.boxes[b] = (state.boxes[b] as number) | bit;
  }
  return state;
}

/**
 * The empty cell with the fewest candidates, encoded as `cell * 512 + mask` so
 * the hot path allocates nothing. `FULL` when the board is full, `DEAD` when
 * some empty cell has no candidate.
 */
function selectCell(state: Search): number {
  const { grid, rows, cols, boxes } = state;
  let bestCell = -1;
  let bestMask = 0;
  let bestCount = 10;
  for (let i = 0; i < CELL_COUNT; i++) {
    if ((grid[i] as number) !== 0) continue;
    const used =
      (rows[ROW_OF[i] as number] as number) |
      (cols[COL_OF[i] as number] as number) |
      (boxes[BOX_OF[i] as number] as number);
    const mask = ALL_DIGITS & ~used;
    if (mask === 0) return DEAD;
    const count = popcount(mask);
    if (count < bestCount) {
      bestCount = count;
      bestCell = i;
      bestMask = mask;
      if (count === 1) break; // nothing can beat a forced cell
    }
  }
  if (bestCell === -1) return FULL;
  return bestCell * 512 + bestMask;
}

function put(state: Search, cell: number, digit: number): void {
  const bit = 1 << (digit - 1);
  const r = ROW_OF[cell] as number;
  const c = COL_OF[cell] as number;
  const b = BOX_OF[cell] as number;
  state.grid[cell] = digit;
  state.rows[r] = (state.rows[r] as number) | bit;
  state.cols[c] = (state.cols[c] as number) | bit;
  state.boxes[b] = (state.boxes[b] as number) | bit;
}

function undo(state: Search, cell: number, digit: number): void {
  const bit = ~(1 << (digit - 1));
  const r = ROW_OF[cell] as number;
  const c = COL_OF[cell] as number;
  const b = BOX_OF[cell] as number;
  state.grid[cell] = 0;
  state.rows[r] = (state.rows[r] as number) & bit;
  state.cols[c] = (state.cols[c] as number) & bit;
  state.boxes[b] = (state.boxes[b] as number) & bit;
}

/**
 * Depth-first search for one completion. `rng` is the only source of variation:
 * `null` tries candidates in ascending digit order (so `solve` is a pure
 * function of the grid), an `Rng` shuffles them (so `solveRandom` is a pure
 * function of the grid and the seed).
 */
function searchOne(state: Search, rng: Rng | null): boolean {
  const selected = selectCell(state);
  if (selected === FULL) return true;
  if (selected === DEAD) return false;

  const cell = selected >> 9;
  const mask = selected & ALL_DIGITS;
  const order = rng === null ? digitsOf(mask) : shuffle(digitsOf(mask), rng);

  for (const digit of order) {
    put(state, cell, digit);
    if (searchOne(state, rng)) return true;
    undo(state, cell, digit);
  }
  return false;
}

/** Count completions, stopping as soon as `limit` have been found. */
function searchCount(state: Search, limit: number, found: number): number {
  const selected = selectCell(state);
  if (selected === FULL) return found + 1;
  if (selected === DEAD) return found;

  const cell = selected >> 9;
  const mask = selected & ALL_DIGITS;
  let total = found;
  for (const digit of digitsOf(mask)) {
    put(state, cell, digit);
    total = searchCount(state, limit, total);
    undo(state, cell, digit);
    if (total >= limit) break;
  }
  return total;
}

/**
 * One completion of `grid`, or `null` when it has none — including when `grid`
 * is not a legal position (a repeated digit in a unit) or is the wrong length.
 * The returned grid is a new array; `grid` itself is not touched.
 *
 * Candidates are tried in ascending digit order, so for a puzzle with several
 * solutions this returns the lexicographically first. For a puzzle with exactly
 * one (decision 5, every puzzle we serve) that distinction does not arise.
 */
export function solve(grid: Grid): Grid | null {
  const state = begin(grid);
  if (state === null) return null;
  return searchOne(state, null) ? state.grid : null;
}

/**
 * How many completions `grid` has, counting no further than `limit`. Returns 0
 * for an illegal or unsolvable grid, and `limit` for anything with at least
 * that many. `countSolutions(g, 2) === 1` is the uniqueness proof of decision 5.
 * `grid` is not touched.
 */
export function countSolutions(grid: Grid, limit: number): number {
  if (limit <= 0) return 0;
  const state = begin(grid);
  if (state === null) return 0;
  return searchCount(state, limit, 0);
}

/**
 * Like `solve`, but candidate digits are tried in an order drawn from `rng`, so
 * `solveRandom(emptyGrid(), createRng(seed))` is a uniformly-ish varied full
 * board and the same seed always gives the same one. That is how WP-C starts a
 * generation (decision 17), and it is why determinism is an acceptance
 * criterion rather than a nicety (decision 3).
 *
 * `rng` is advanced as the search runs, so pass a fresh `createRng(seed)` when
 * you want a reproducible board.
 */
export function solveRandom(grid: Grid, rng: Rng): Grid | null {
  const state = begin(grid);
  if (state === null) return null;
  return searchOne(state, rng) ? state.grid : null;
}
