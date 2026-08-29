/**
 * Technique 3 — SOTD's **Candidate Lines**
 * (https://www.sudokuoftheday.com/techniques/candidate-lines, read 2026-08-29).
 * Their words:
 *
 *   "If you look within a box, and find that all of the places where you can
 *    put a particular number lie along a single line, then you can be sure that
 *    wherever you put the number in that box, it has to be on the line. ... You
 *    know that none of the other positions on that line (in the other two
 *    boxes) could contain that number, so you can remove those as candidates!"
 *
 * So this is the box -> line direction only (elsewhere called a pointing pair
 * or triple). The line -> box direction is not this technique on SOTD's ladder;
 * it falls out of Double Pairs and Multiple Lines, which look at a whole band
 * or stack. Decision 16 costs it 350 first, 200 subsequently.
 *
 * ## Scan order (deterministic — WP-T1 re-validates against it)
 *
 * Boxes 0 -> 8; inside a box digits 1 -> 9; for each digit the **row** line is
 * tested before the **column** line. The first combination that actually
 * removes a candidate is the step; a pattern that eliminates nothing is skipped
 * rather than returned, because a step must change something.
 *
 * A box with exactly *one* place for the digit is a Single Position
 * (`hiddenSingle`), which is cheaper and fires first on the ladder, so this
 * technique requires **at least two** candidate cells in the box.
 */

import type { Elimination, Step } from '../types.js';
import { BOXES, COL_OF, COLS, ROW_OF, ROWS } from '../grid.js';
import { type TechniqueState, cellList, hasCandidate, placesFor, unitName } from './state.js';

export function candidateLines(state: TechniqueState): Step | null {
  for (let box = 0; box < 9; box++) {
    const boxCells = BOXES[box] as readonly number[];
    for (let digit = 1; digit <= 9; digit++) {
      const places = placesFor(state, boxCells, digit);
      if (places.length < 2) continue;

      const first = places[0] as number;
      const row = ROW_OF[first] as number;
      const col = COL_OF[first] as number;

      if (places.every((cell) => ROW_OF[cell] === row)) {
        const step = build(state, box, digit, places, ROWS[row] as readonly number[], row);
        if (step !== null) return step;
      }
      if (places.every((cell) => COL_OF[cell] === col)) {
        const step = build(state, box, digit, places, COLS[col] as readonly number[], 9 + col);
        if (step !== null) return step;
      }
    }
  }
  return null;
}

function build(
  state: TechniqueState,
  box: number,
  digit: number,
  places: readonly number[],
  lineCells: readonly number[],
  lineUnit: number,
): Step | null {
  const inBox = new Set(places);
  const eliminations: Elimination[] = [];
  for (const cell of lineCells) {
    if (inBox.has(cell)) continue;
    if (hasCandidate(state, cell, digit)) eliminations.push({ cell, digits: [digit] });
  }
  if (eliminations.length === 0) return null;

  const boxUnit = 18 + box;
  return {
    technique: 'candidateLines',
    cells: [...places],
    units: [boxUnit, lineUnit],
    placements: [],
    eliminations,
    reason:
      `In ${unitName(boxUnit)} the ${digit} can only go in ${cellList(places)}, all on ` +
      `${unitName(lineUnit)}, so the ${digit} of that line lives in this box and comes out of ` +
      `${cellList(eliminations.map((e) => e.cell))}.`,
  };
}
