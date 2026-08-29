/**
 * Technique 14 — SOTD's **Swordfish**
 * (https://www.sudokuoftheday.com/techniques/swordfish, read 2026-08-29):
 *
 *   "a Swordfish needs a closed chain of 6 (or more) values" — three rows in
 *   which a candidate is confined to the same three columns, so that "every one
 *   of those columns is occupied". Once the loop is closed you "can eliminate
 *   the candidate from all other cells in those three columns, outside the
 *   three lines forming the chain". SOTD is explicit that X-Wings and Swordfish
 *   are the same idea at different widths — two lines and three — and warns
 *   that "it might not mean you can remove any candidates every time, though,
 *   which means you have to carry on searching".
 *
 * So this file is `xWing.ts` widened by one line, and the two share their
 * shape deliberately: same orientation-then-digit-then-lines scan, same
 * corners-and-covers `Step`. A base line contributes **two or three** places —
 * two is what "6 (or more)" allows at the bottom end, and it is what makes the
 * common "incomplete" swordfish work. Decision 16 costs it 8000 first, 6000
 * subsequently, the top of the ladder.
 *
 * A pattern whose three base lines only cover two lines is an X-Wing with a
 * passenger, and `xWing` is cheaper, so the rater has already taken it: this
 * search requires the covers to number exactly three.
 *
 * ## Scan order (deterministic — WP-T1 re-validates against it)
 *
 * Orientation first: the **row** swordfish (three rows, eliminations down three
 * columns) are searched before the **column** ones. Inside an orientation,
 * digits 1 -> 9, then base-line triples `(l1 < l2 < l3)` in ascending
 * lexicographic order. The first combination that removes a candidate is the
 * step; a genuine swordfish that eliminates nothing is skipped, because a step
 * must change something.
 */

import type { Elimination, Step } from '../types.js';
import { COLS, ROWS } from '../grid.js';
import { type TechniqueState, cellList, hasCandidate, placesFor, unitName } from './state.js';

export function swordfish(state: TechniqueState): Step | null {
  const rowStep = search(state, true);
  if (rowStep !== null) return rowStep;
  return search(state, false);
}

/**
 * `rowBased` true: the three base lines are rows and the eliminations run down
 * the three columns the corners share. False: the mirror image.
 */
function search(state: TechniqueState, rowBased: boolean): Step | null {
  const bases = rowBased ? ROWS : COLS;
  const covers = rowBased ? COLS : ROWS;
  const baseUnit = (i: number): number => (rowBased ? i : 9 + i);
  const coverUnit = (i: number): number => (rowBased ? 9 + i : i);
  /** which cover line a cell of a base line sits in: its column, or its row */
  const coverOf = (cell: number): number => (rowBased ? cell % 9 : Math.floor(cell / 9));

  for (let digit = 1; digit <= 9; digit++) {
    const places: (number[] | null)[] = [];
    for (let i = 0; i < 9; i++) {
      const at = placesFor(state, bases[i] as readonly number[], digit);
      places.push(at.length >= 2 && at.length <= 3 ? at : null);
    }

    for (let a = 0; a < 9; a++) {
      const first = places[a];
      if (!first) continue;
      for (let b = a + 1; b < 9; b++) {
        const second = places[b];
        if (!second) continue;
        for (let c = b + 1; c < 9; c++) {
          const third = places[c];
          if (!third) continue;

          const corners = [...first, ...second, ...third].sort((x, y) => x - y);
          const coverLines = [...new Set(corners.map(coverOf))].sort((x, y) => x - y);
          if (coverLines.length !== 3) continue;

          const inPattern = new Set(corners);
          const eliminations: Elimination[] = [];
          for (const line of coverLines) {
            for (const cell of covers[line] as readonly number[]) {
              if (inPattern.has(cell)) continue;
              if (hasCandidate(state, cell, digit)) eliminations.push({ cell, digits: [digit] });
            }
          }
          if (eliminations.length === 0) continue;
          eliminations.sort((x, y) => x.cell - y.cell);

          const baseUnits = [baseUnit(a), baseUnit(b), baseUnit(c)];
          const coverUnits = coverLines.map(coverUnit);
          return {
            technique: 'swordfish',
            cells: corners,
            units: [...baseUnits, ...coverUnits],
            placements: [],
            eliminations,
            reason:
              `The ${digit} of ${unitName(baseUnits[0] as number)}, ` +
              `${unitName(baseUnits[1] as number)} and ${unitName(baseUnits[2] as number)} is ` +
              `confined to ${unitName(coverUnits[0] as number)}, ` +
              `${unitName(coverUnits[1] as number)} and ${unitName(coverUnits[2] as number)} ` +
              `between them. Those three lines must take all three ${digit}s, so the ${digit} ` +
              `comes out of ${cellList(eliminations.map((e) => e.cell))}.`,
          };
        }
      }
    }
  }
  return null;
}
