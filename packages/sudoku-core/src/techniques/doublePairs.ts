/**
 * Technique 4 — SOTD's **Double Pairs**
 * (https://www.sudokuoftheday.com/techniques/double-pairs, read 2026-08-29).
 * Their words:
 *
 *   "This technique relies on spotting two pairs of candidates for a value, and
 *    using these to rule out candidates from other boxes. ... Take a look at
 *    the places where 2 can be for the middle column of blocks ... You can see
 *    that they only lie along two lines (columns 4 and 6). Because the 2s are
 *    limited to those positions in the top blocks, it means that columns 4 and
 *    6 are taken. That means that any of the candidates for 2 in the bottom
 *    block can be removed from either of those two columns. ... This technique
 *    is reasonably easy to spot because you only need to see candidate pairs in
 *    two blocks."
 *
 * Read literally, and that is how it is implemented here: inside one chute (a
 * band or a stack — SOTD's "column of blocks"), **two** of the three boxes each
 * have exactly **two** candidate cells for the digit, one on each of the *same*
 * two lines. Those two boxes must take those two lines between them — they
 * cannot both use the same one — so the third box's digit is forced onto the
 * remaining line, and the digit comes out of the third box's cells on the other
 * two lines.
 *
 * The looser shape SOTD describes on the next page (any number of candidates,
 * spread over two boxes, still confined to two lines) is **Multiple Lines**,
 * technique 5, and is deliberately not accepted here: see `multipleLines.ts`.
 * Decision 16 costs Double Pairs 500 first, 250 subsequently.
 *
 * ## Scan order (deterministic — WP-T1 re-validates against it)
 *
 * Chutes in `CHUTES` order (bands 0,1,2 then stacks 0,1,2); inside a chute
 * digits 1 -> 9; inside a digit the **excluded** box — the one the eliminations
 * land in — taken as chute position 0, then 1, then 2. The first combination
 * that removes a candidate is the step.
 */

import type { Elimination, Step } from '../types.js';
import { type TechniqueState, cellList, placesFor, unitName } from './state.js';
import { CHUTES, boxCells } from './chutes.js';

export function doublePairs(state: TechniqueState): Step | null {
  for (const chute of CHUTES) {
    for (let digit = 1; digit <= 9; digit++) {
      const places = chute.boxes.map((box) => placesFor(state, boxCells(box), digit));

      for (let target = 0; target < 3; target++) {
        const others = [0, 1, 2].filter((k) => k !== target) as [number, number];
        const a = places[others[0]] as number[];
        const b = places[others[1]] as number[];

        // "two pairs of candidates" — two cells in each box, and the two cells
        // of a box on different lines, so the box genuinely occupies both.
        if (a.length !== 2 || b.length !== 2) continue;
        const linesA = a.map(chute.lineOf);
        const linesB = b.map(chute.lineOf);
        if (linesA[0] === linesA[1] || linesB[0] === linesB[1]) continue;
        const pair = [...linesA].sort((x, y) => x - y);
        if (pair.join() !== [...linesB].sort((x, y) => x - y).join()) continue;

        const eliminations: Elimination[] = [];
        for (const cell of places[target] as number[]) {
          if (pair.includes(chute.lineOf(cell))) eliminations.push({ cell, digits: [digit] });
        }
        if (eliminations.length === 0) continue;

        const lineUnits = pair.map((k) => chute.lineUnits[k] as number);
        const patternCells = [...a, ...b].sort((x, y) => x - y);
        const boxUnits = others.map((k) => 18 + (chute.boxes[k] as number));
        const targetBoxUnit = 18 + (chute.boxes[target] as number);
        const freeLineUnit = chute.lineUnits[[0, 1, 2].find((k) => !pair.includes(k)) as number];

        return {
          technique: 'doublePairs',
          cells: patternCells,
          units: [...boxUnits, targetBoxUnit, ...lineUnits],
          placements: [],
          eliminations,
          reason:
            `${unitName(boxUnits[0] as number)} and ${unitName(boxUnits[1] as number)} each have ` +
            `just two places for the ${digit}, and between them they use up ` +
            `${unitName(lineUnits[0] as number)} and ${unitName(lineUnits[1] as number)}. ` +
            `So the ${digit} of ${unitName(targetBoxUnit)} has to sit on ` +
            `${unitName(freeLineUnit as number)}, and it comes out of ` +
            `${cellList(eliminations.map((e) => e.cell))}.`,
        };
      }
    }
  }
  return null;
}
