/**
 * The six **chutes** — the three horizontal bands of boxes and the three
 * vertical stacks — shared by SOTD's Double Pairs and Multiple Lines, both of
 * which reason about "the middle column of blocks" rather than about a single
 * unit.
 *
 * A chute is three boxes and the three lines they share. Band 0 is boxes 0,1,2
 * and rows 0,1,2; stack 1 is boxes 1,4,7 and columns 3,4,5. Every cell of a
 * chute sits in exactly one of its three lines, so `lineOf` is total.
 *
 * The iteration order is fixed and both techniques document it: **bands 0,1,2
 * then stacks 0,1,2** — index 0..2 are the bands, 3..5 the stacks.
 */

import { BOXES, COL_OF, COLS, ROWS, ROW_OF } from '../grid.js';

export interface Chute {
  /** the three box indices 0..8, in board order */
  boxes: readonly [number, number, number];
  /** the three line unit indices into `UNITS` (rows 0..8 or columns 9..17) */
  lineUnits: readonly [number, number, number];
  /** the cells of each of the three lines */
  lines: readonly (readonly number[])[];
  /** which of the three lines (0,1,2) a cell of this chute lies in */
  lineOf: (cell: number) => number;
  /** true for a band (rows), false for a stack (columns) — only for wording */
  horizontal: boolean;
}

/** Bands 0,1,2 then stacks 0,1,2. Built once at module load. */
export const CHUTES: readonly Chute[] = (() => {
  const out: Chute[] = [];
  for (let band = 0; band < 3; band++) {
    const base = band * 3;
    out.push({
      boxes: [base, base + 1, base + 2],
      lineUnits: [base, base + 1, base + 2],
      lines: [ROWS[base], ROWS[base + 1], ROWS[base + 2]] as readonly (readonly number[])[],
      lineOf: (cell) => (ROW_OF[cell] as number) - base,
      horizontal: true,
    });
  }
  for (let stack = 0; stack < 3; stack++) {
    const base = stack * 3;
    out.push({
      boxes: [stack, stack + 3, stack + 6],
      lineUnits: [9 + base, 9 + base + 1, 9 + base + 2],
      lines: [COLS[base], COLS[base + 1], COLS[base + 2]] as readonly (readonly number[])[],
      lineOf: (cell) => (COL_OF[cell] as number) - base,
      horizontal: false,
    });
  }
  return out;
})();

/** The nine cells of box `box`. A thin alias so the chute code reads in one voice. */
export function boxCells(box: number): readonly number[] {
  return BOXES[box] as readonly number[];
}
