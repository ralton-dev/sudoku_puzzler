/**
 * Technique 10 — SOTD's **X-Wings**
 * (https://www.sudokuoftheday.com/techniques/x-wings, read 2026-08-29):
 *
 *   "X-Wings are when there are two lines, each having the same two positions
 *    for a number. ... whichever position 6 occupies in the top row, forces the
 *    other to occupy the opposite position in the bottom row ... you know for
 *    sure that both will be occupied. And because you know that the 6 will
 *    definitely be in both of those two column positions, you can look up and
 *    down those columns, and remove any other candidates!"
 *
 * Both orientations count — "it works the other way too, if you can spot
 * similar columns". Decision 16 costs it 2800 first, 1600 subsequently.
 *
 * ## Scan order (deterministic — WP-T1 re-validates against it)
 *
 * Orientation first: the **row** X-wings (two rows, eliminations down two
 * columns) are searched before the **column** ones. Inside an orientation,
 * digits 1 -> 9, then base-line pairs `(l1 < l2)` in ascending lexicographic
 * order. The first combination that removes a candidate is the step; a genuine
 * X-wing that eliminates nothing is skipped, which SOTD warns is common: "they
 * won't always lead to you being able to remove candidates".
 */

import type { Elimination, Step } from '../types.js';
import { COLS, ROWS } from '../grid.js';
import { type TechniqueState, cellList, hasCandidate, placesFor, unitName } from './state.js';

export function xWing(state: TechniqueState): Step | null {
  const rowStep = search(state, true);
  if (rowStep !== null) return rowStep;
  return search(state, false);
}

/**
 * `rowBased` true: the two base lines are rows and the eliminations run down
 * the two columns the corners share. False: the mirror image.
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
      places.push(at.length === 2 ? at : null);
    }

    for (let a = 0; a < 9; a++) {
      const first = places[a];
      if (!first) continue;
      const coversA = first.map(coverOf);
      for (let b = a + 1; b < 9; b++) {
        const second = places[b];
        if (!second) continue;
        const coversB = second.map(coverOf);
        if (coversA[0] !== coversB[0] || coversA[1] !== coversB[1]) continue;

        const corners = [...first, ...second].sort((x, y) => x - y);
        const inPattern = new Set(corners);
        const eliminations: Elimination[] = [];
        for (const c of coversA) {
          for (const cell of covers[c as number] as readonly number[]) {
            if (inPattern.has(cell)) continue;
            if (hasCandidate(state, cell, digit)) eliminations.push({ cell, digits: [digit] });
          }
        }
        if (eliminations.length === 0) continue;
        eliminations.sort((x, y) => x.cell - y.cell);

        const baseUnits = [baseUnit(a), baseUnit(b)];
        const coverUnits = coversA.map((c) => coverUnit(c as number));
        return {
          technique: 'xWing',
          cells: corners,
          units: [...baseUnits, ...coverUnits],
          placements: [],
          eliminations,
          reason:
            `The ${digit} of ${unitName(baseUnits[0] as number)} and of ` +
            `${unitName(baseUnits[1] as number)} each have only two places, and they line up in ` +
            `${unitName(coverUnits[0] as number)} and ${unitName(coverUnits[1] as number)}. ` +
            `Those two lines must take both ${digit}s between them, so the ${digit} comes out of ` +
            `${cellList(eliminations.map((e) => e.cell))}.`,
        };
      }
    }
  }
  return null;
}
