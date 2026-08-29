/**
 * Grid representation and the precomputed unit/peer tables everything else in
 * the library reads. Pure and dependency-free (decision 3), 9x9 only
 * (decision 1): every table below is built once at module load and never
 * rebuilt, because there is only ever one board shape.
 *
 * ## The bitmask convention — read this before writing a technique
 *
 * A candidate set is a **9-bit mask where digit `d` occupies bit `d - 1`**:
 *
 *     digit 1 -> 0b000000001 (1)      digit 9 -> 0b100000000 (256)
 *     mask for {1,4,9} = bitFor(1) | bitFor(4) | bitFor(9) = 1 | 8 | 256 = 265
 *
 * There is no bit 9 and bit 0 is not "empty". `ALL_DIGITS` (0x1ff = 511) is the
 * full set, `0` is the empty set. Use `bitFor`, `digitsOf` and `popcount`
 * rather than open-coding the shift, and never assume bit `d` means digit `d`.
 */

import { CELL_COUNT, type Grid } from './types.js';

/** Every digit as a mask: 0b111111111. */
export const ALL_DIGITS = 0x1ff;

/** The mask for a single digit 1..9. Bit `d - 1`, per the note above. */
export function bitFor(digit: number): number {
  return 1 << (digit - 1);
}

/** How many digits a candidate mask holds. */
export function popcount(mask: number): number {
  let m = mask;
  let n = 0;
  while (m !== 0) {
    m &= m - 1;
    n++;
  }
  return n;
}

/** The digits in a candidate mask, ascending. `digitsOf(265)` is `[1, 4, 9]`. */
export function digitsOf(mask: number): number[] {
  const out: number[] = [];
  for (let d = 1; d <= 9; d++) {
    if ((mask & bitFor(d)) !== 0) out.push(d);
  }
  return out;
}

/** The lowest digit in a mask, or 0 when the mask is empty. */
export function lowestDigit(mask: number): number {
  if (mask === 0) return 0;
  return 31 - Math.clz32(mask & -mask) + 1;
}

// --- the tables ----------------------------------------------------------

/** Row index 0..8 of each cell. */
export const ROW_OF: readonly number[] = Array.from({ length: CELL_COUNT }, (_, i) =>
  Math.floor(i / 9),
);

/** Column index 0..8 of each cell. */
export const COL_OF: readonly number[] = Array.from({ length: CELL_COUNT }, (_, i) => i % 9);

/** Box index 0..8 of each cell, boxes numbered left-to-right then top-to-bottom. */
export const BOX_OF: readonly number[] = Array.from(
  { length: CELL_COUNT },
  (_, i) => Math.floor(i / 27) * 3 + Math.floor((i % 9) / 3),
);

const buildUnits = (of: readonly number[]): number[][] => {
  const units: number[][] = Array.from({ length: 9 }, () => []);
  for (let i = 0; i < CELL_COUNT; i++) {
    (units[of[i] as number] as number[]).push(i);
  }
  return units;
};

/** `ROWS[r]` is the nine cell indices of row `r`, ascending. */
export const ROWS: readonly (readonly number[])[] = buildUnits(ROW_OF);

/** `COLS[c]` is the nine cell indices of column `c`, ascending. */
export const COLS: readonly (readonly number[])[] = buildUnits(COL_OF);

/** `BOXES[b]` is the nine cell indices of box `b`, ascending. */
export const BOXES: readonly (readonly number[])[] = buildUnits(BOX_OF);

/**
 * All 27 units in one table, in the order `Step.units` documents in `types.ts`:
 * rows are 0..8, columns 9..17, boxes 18..26.
 */
export const UNITS: readonly (readonly number[])[] = [...ROWS, ...COLS, ...BOXES];

/** The three unit indices (into `UNITS`) each cell belongs to: row, column, box. */
export const UNITS_OF: readonly (readonly [number, number, number])[] = Array.from(
  { length: CELL_COUNT },
  (_, i) => [ROW_OF[i] as number, 9 + (COL_OF[i] as number), 18 + (BOX_OF[i] as number)] as const,
);

/**
 * `PEERS[i]` is the 20 cells that share a row, column or box with `i`,
 * ascending, never including `i` itself.
 */
export const PEERS: readonly (readonly number[])[] = Array.from({ length: CELL_COUNT }, (_, i) => {
  const seen = new Set<number>();
  for (const unit of UNITS_OF[i] as readonly number[]) {
    for (const j of UNITS[unit] as readonly number[]) {
      if (j !== i) seen.add(j);
    }
  }
  return [...seen].sort((a, b) => a - b);
});

// --- parse / format ------------------------------------------------------

/**
 * An 81-character string to a `Grid`. `0` and `.` both mean empty; any other
 * character, or any length but 81, throws. The string is row-major, so index 0
 * is r0c0 and index 80 is r8c8.
 */
export function parseGrid(text: string): Grid {
  if (text.length !== CELL_COUNT) {
    throw new Error(`expected ${CELL_COUNT} characters, got ${text.length}`);
  }
  const grid = new Uint8Array(CELL_COUNT);
  for (let i = 0; i < CELL_COUNT; i++) {
    const ch = text[i] as string;
    if (ch === '0' || ch === '.') continue;
    const digit = ch.charCodeAt(0) - 48;
    if (digit < 1 || digit > 9) {
      throw new Error(`bad character ${JSON.stringify(ch)} at index ${i}`);
    }
    grid[i] = digit;
  }
  return grid;
}

/** A `Grid` back to 81 characters, empty cells as `0`. Inverse of `parseGrid`. */
export function formatGrid(grid: Grid): string {
  let out = '';
  for (let i = 0; i < CELL_COUNT; i++) out += String(grid[i] as number);
  return out;
}

/** A fresh empty grid. */
export function emptyGrid(): Grid {
  return new Uint8Array(CELL_COUNT);
}

// --- validity ------------------------------------------------------------

/**
 * True when no digit repeats in any row, column or box. Empty cells (0) are
 * ignored, so a partly-filled grid can be valid. A grid of the wrong length, or
 * holding a value outside 0..9, is not valid.
 */
export function isValidGrid(grid: Grid): boolean {
  if (grid.length !== CELL_COUNT) return false;
  for (let i = 0; i < CELL_COUNT; i++) {
    const value = grid[i] as number;
    if (value > 9) return false;
  }
  for (const unit of UNITS) {
    let seen = 0;
    for (const cell of unit) {
      const value = grid[cell] as number;
      if (value === 0) continue;
      const bit = bitFor(value);
      if ((seen & bit) !== 0) return false;
      seen |= bit;
    }
  }
  return true;
}

/** True when `grid` is valid and every cell is filled — a finished board. */
export function isComplete(grid: Grid): boolean {
  if (grid.length !== CELL_COUNT) return false;
  for (let i = 0; i < CELL_COUNT; i++) {
    if ((grid[i] as number) === 0) return false;
  }
  return isValidGrid(grid);
}

// --- candidates ----------------------------------------------------------

/**
 * The digits that could legally go in cell `idx`, as a bitmask (bit `d - 1` for
 * digit `d` — see the note at the top of this file).
 *
 * **A filled cell has no candidates: this returns `0` for it.** It is not the
 * mask of the digit already there. Callers building a candidate state should
 * skip filled cells, or treat 0 as "nothing to decide here".
 *
 * `0` is also what an *unsolvable* empty cell returns — one whose peers already
 * use all nine digits. The two cases are told apart by `grid[idx]`.
 *
 * These are naive candidates: peer elimination only, no technique has run.
 */
export function candidates(grid: Grid, idx: number): number {
  if ((grid[idx] as number) !== 0) return 0;
  let mask = ALL_DIGITS;
  for (const peer of PEERS[idx] as readonly number[]) {
    const value = grid[peer] as number;
    if (value !== 0) mask &= ~bitFor(value);
  }
  return mask;
}
