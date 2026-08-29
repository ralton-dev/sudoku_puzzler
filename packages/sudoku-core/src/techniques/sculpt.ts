/**
 * Hand-built candidate states for the technique tests.
 *
 * Every technique below is tested on a **sculpted** state rather than a real
 * puzzle position: start from the empty board, where every cell holds all nine
 * candidates and no technique fires, then remove exactly the candidates the
 * pattern needs. That makes the negative case free (the untouched board) and,
 * more importantly, makes the positive case unambiguous — the sculpted pattern
 * is the *only* instance on the board, so the assertion pins the technique's
 * documented scan order rather than whatever it happened to trip over first.
 *
 * It is also the shape WP-T1 stores: `createState(grid, eliminated)`. A
 * sculpted state is a grid plus a list of eliminations, nothing else.
 *
 * It lives outside `*.test.ts` only because ten test files share it, so it is
 * compiled into the package like everything else; it is kept to array-building
 * and imports nothing but `state.ts`. WP-D2's four technique tests should reuse
 * it rather than growing a second set of helpers.
 */

import { type TechniqueState, eliminate, stateFromString } from './state.js';

/** The empty board: 81 cells, nine candidates each, nothing to find. */
export function blank(): TechniqueState {
  return stateFromString('0'.repeat(81));
}

/** Remove `digits` from every cell in `cells`. Returns the state, for chaining. */
export function strip(
  state: TechniqueState,
  cells: readonly number[],
  digits: readonly number[],
): TechniqueState {
  for (const cell of cells) eliminate(state, cell, digits);
  return state;
}

/** Keep `digits` in `cell` and nothing else. */
export function only(
  state: TechniqueState,
  cell: number,
  digits: readonly number[],
): TechniqueState {
  const drop = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => !digits.includes(d));
  return strip(state, [cell], drop);
}

/** The nine cells of row `row`, ascending. */
export function rowOf(row: number): number[] {
  return Array.from({ length: 9 }, (_, c) => row * 9 + c);
}

/** The nine cells of column `col`, ascending. */
export function colOf(col: number): number[] {
  return Array.from({ length: 9 }, (_, r) => r * 9 + col);
}
