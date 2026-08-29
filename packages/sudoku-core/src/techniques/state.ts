/**
 * The candidate state every technique reads and the rater mutates.
 *
 * ## Why there is a state at all
 *
 * `candidates(grid, i)` in `grid.ts` is *naive*: peer elimination only, nothing
 * a technique worked out. That is fine for the solver, which only ever places
 * digits, and useless for the rater, because techniques 3..10 produce
 * **eliminations without placements** — the whole point of Candidate Lines is
 * that it tells you where a digit *cannot* go. Recomputing naive candidates
 * would throw that away on every step, so the rater carries its own state:
 *
 *   - `grid` — the working board, 0 for empty (same convention as everywhere).
 *   - `cand` — 81 candidate bitmasks, digit `d` at bit `d - 1` (`grid.ts`).
 *     **A filled cell's mask is 0**, exactly as `candidates()` returns 0 for
 *     one. Techniques must therefore test `grid[i] === 0` before reading a
 *     mask, or simply rely on 0 meaning "nothing to decide here".
 *
 * ## Rebuilding a state without a solver (WP-T1, WP-T2)
 *
 * `createState(grid, eliminated)` is the whole contract: naive candidates from
 * `grid`, then the recorded `eliminated` list applied. A `TrainingExample`
 * stores exactly `{ grid, eliminated }`, so the browser can rebuild the precise
 * position a step was found in — and a test can re-run one technique against it
 * and expect the identical `Step` back.
 */

import type { Elimination, Grid, Step } from '../types.js';
import { CELL_COUNT } from '../types.js';
import { BOX_OF, COL_OF, PEERS, ROW_OF, bitFor, candidates, parseGrid } from '../grid.js';

/** The board plus its candidate masks. Both are mutable; techniques never write. */
export interface TechniqueState {
  /** the working board, 0 = empty */
  grid: Grid;
  /** 81 candidate bitmasks; 0 for a filled cell */
  cand: Int32Array;
}

/**
 * A technique: look at `state`, return the **first** applicable instance in the
 * scan order documented in that technique's file, or `null`. A technique never
 * mutates the state — the rater applies the step it returns.
 *
 * A returned `Step` always changes something. A `Step` with no placements and
 * no eliminations is a bug in the technique, and the rater throws on one rather
 * than looping forever.
 */
export type Technique = (state: TechniqueState) => Step | null;

/**
 * Build the state for `grid`: naive candidates, then `eliminated` removed.
 *
 * `eliminated` is the ledger of what earlier steps had already ruled out — the
 * `TrainingExample.eliminated` field (decision 18). Omit it for a fresh rate.
 */
export function createState(grid: Grid, eliminated: readonly Elimination[] = []): TechniqueState {
  const state: TechniqueState = {
    grid: Uint8Array.from(grid),
    cand: new Int32Array(CELL_COUNT),
  };
  for (let i = 0; i < CELL_COUNT; i++) state.cand[i] = candidates(grid, i);
  for (const { cell, digits } of eliminated) {
    for (const digit of digits) state.cand[cell] = (state.cand[cell] as number) & ~bitFor(digit);
  }
  return state;
}

/** Same as `createState`, from an 81-character position. Handy in tests. */
export function stateFromString(
  text: string,
  eliminated: readonly Elimination[] = [],
): TechniqueState {
  return createState(parseGrid(text), eliminated);
}

/** An independent copy — mutating the copy never touches the original. */
export function cloneState(state: TechniqueState): TechniqueState {
  return { grid: Uint8Array.from(state.grid), cand: Int32Array.from(state.cand) };
}

/**
 * Write `digit` into `cell`: clear the cell's own mask and drop `digit` from
 * every peer's. Returns the number of things that changed, so a caller can tell
 * a real placement from a no-op.
 */
export function place(state: TechniqueState, cell: number, digit: number): number {
  if (state.grid[cell] === digit) return 0;
  let changed = 1;
  state.grid[cell] = digit;
  state.cand[cell] = 0;
  const bit = bitFor(digit);
  for (const peer of PEERS[cell] as readonly number[]) {
    if (((state.cand[peer] as number) & bit) !== 0) {
      state.cand[peer] = (state.cand[peer] as number) & ~bit;
      changed++;
    }
  }
  return changed;
}

/** Remove `digits` from `cell`'s candidates. Returns how many were actually there. */
export function eliminate(state: TechniqueState, cell: number, digits: readonly number[]): number {
  let changed = 0;
  for (const digit of digits) {
    const bit = bitFor(digit);
    if (((state.cand[cell] as number) & bit) !== 0) {
      state.cand[cell] = (state.cand[cell] as number) & ~bit;
      changed++;
    }
  }
  return changed;
}

/**
 * Apply a whole `Step` — its eliminations then its placements — and return the
 * number of changes it made. **Zero means the step was a no-op**, which is the
 * infinite-loop hazard the rater guards against.
 *
 * Note that a placement's own knock-on peer eliminations are *not* listed in
 * `Step.eliminations`: they follow from the placement and would be noise in the
 * training trace. `place` does them.
 */
export function applyStep(state: TechniqueState, step: Step): number {
  let changed = 0;
  for (const { cell, digits } of step.eliminations) changed += eliminate(state, cell, digits);
  for (const { cell, digit } of step.placements) changed += place(state, cell, digit);
  return changed;
}

/** True when `cell` still holds `digit` as a candidate. */
export function hasCandidate(state: TechniqueState, cell: number, digit: number): boolean {
  return ((state.cand[cell] as number) & bitFor(digit)) !== 0;
}

/**
 * The cells of `unit` (an index into `UNITS`) that are still empty and hold
 * `digit` as a candidate, ascending.
 */
export function placesFor(state: TechniqueState, unit: readonly number[], digit: number): number[] {
  const bit = bitFor(digit);
  const out: number[] = [];
  for (const cell of unit) {
    if (((state.cand[cell] as number) & bit) !== 0) out.push(cell);
  }
  return out;
}

// --- learner-readable names ---------------------------------------------
//
// Every `reason` string is written for someone learning the game (decision 18),
// so rows, columns, boxes and digits are all 1-based here, never 0-based.

/** `r4c7` — 1-based, the way a person reads a board. */
export function cellName(cell: number): string {
  return `r${(ROW_OF[cell] as number) + 1}c${(COL_OF[cell] as number) + 1}`;
}

/** `r4c7 and r6c7`, `r1c1, r1c4 and r1c9` — an Oxford-comma-free list. */
export function cellList(cells: readonly number[]): string {
  return joinWords(cells.map(cellName));
}

/** `3 and 7`, `1, 4 and 9`. */
export function digitList(digits: readonly number[]): string {
  return joinWords(digits.map(String));
}

/** `row 4`, `column 7`, `box 3` for a `UNITS` index (rows 0-8, cols 9-17, boxes 18-26). */
export function unitName(unit: number): string {
  if (unit < 9) return `row ${unit + 1}`;
  if (unit < 18) return `column ${unit - 9 + 1}`;
  return `box ${unit - 18 + 1}`;
}

/** The three `UNITS` indices of a cell: row, column, box. */
export function unitsOfCell(cell: number): [number, number, number] {
  return [ROW_OF[cell] as number, 9 + (COL_OF[cell] as number), 18 + (BOX_OF[cell] as number)];
}

function joinWords(parts: readonly string[]): string {
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0] as string;
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1] as string}`;
}
