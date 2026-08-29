/**
 * Technique 5 — SOTD's **Multiple Lines**
 * (https://www.sudokuoftheday.com/techniques/multiple-lines, read 2026-08-29).
 * Their words:
 *
 *   "This is very similar to the Double Pairs test, but is a little harder to
 *    spot. It works in the same way, but the candidates that occupy the lines
 *    could be spread across two of the blocks, and there could be several
 *    candidates in each line. ... you can see that the 5s are only in the first
 *    two columns. This means that columns 1 and 2 are already taken for
 *    candidates for 5, leaving the middle box with only column 3 for its 5s.
 *    ... we can remove the candidates for 5 from column 1 in the middle box.
 *    ... there will be more than just two pairs."
 *
 * So the pattern is the same chute argument as Double Pairs with the pair
 * requirement dropped: take two boxes of a band or stack; if **every** place
 * for the digit across those two boxes lies on only **two** of the chute's
 * three lines, those two boxes must take those two lines between them (they
 * each need the digit, and two boxes of a chute can never share a line), so the
 * third box is forced onto the remaining line and the digit comes out of its
 * cells on the other two.
 *
 * Two consequences worth knowing, both deliberate:
 *
 *  - The exact Double Pairs shape (each of the two boxes holding exactly two
 *    candidates, one per line) is **excluded** here — SOTD says "there will be
 *    more than just two pairs", and Double Pairs is cheaper on the ladder, so
 *    accepting it would only ever double-count. Everything looser is accepted.
 *  - What is usually called *box/line reduction* — "the digit in row 3 only
 *    appears inside box 1, so remove it from the rest of box 1" — is exactly
 *    this pattern seen from the other end, and SOTD has no separate name for
 *    it. If the digit is absent from one line inside two boxes, those two boxes
 *    are confined to the remaining two lines, which is this technique.
 *
 * Decision 16 costs it 700 first, 400 subsequently.
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

export function multipleLines(state: TechniqueState): Step | null {
  for (const chute of CHUTES) {
    for (let digit = 1; digit <= 9; digit++) {
      const places = chute.boxes.map((box) => placesFor(state, boxCells(box), digit));

      for (let target = 0; target < 3; target++) {
        const others = [0, 1, 2].filter((k) => k !== target) as [number, number];
        const a = places[others[0]] as number[];
        const b = places[others[1]] as number[];
        if (a.length === 0 || b.length === 0) continue;

        const used = new Set([...a, ...b].map(chute.lineOf));
        if (used.size !== 2) continue;
        if (isDoublePairShape(a, b, chute.lineOf)) continue; // technique 4's job

        const pair = [...used].sort((x, y) => x - y);
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
          technique: 'multipleLines',
          cells: patternCells,
          units: [...boxUnits, targetBoxUnit, ...lineUnits],
          placements: [],
          eliminations,
          reason:
            `Across ${unitName(boxUnits[0] as number)} and ${unitName(boxUnits[1] as number)} ` +
            `every place for the ${digit} lies on ${unitName(lineUnits[0] as number)} or ` +
            `${unitName(lineUnits[1] as number)}, so those two lines are spoken for. ` +
            `${unitName(targetBoxUnit)} must then take its ${digit} on ` +
            `${unitName(freeLineUnit as number)}, and it comes out of ` +
            `${cellList(eliminations.map((e) => e.cell))}.`,
        };
      }
    }
  }
  return null;
}

/** The literal Double Pairs pattern: two cells per box, one on each of the two lines. */
function isDoublePairShape(
  a: readonly number[],
  b: readonly number[],
  lineOf: (cell: number) => number,
): boolean {
  if (a.length !== 2 || b.length !== 2) return false;
  return (
    lineOf(a[0] as number) !== lineOf(a[1] as number) &&
    lineOf(b[0] as number) !== lineOf(b[1] as number)
  );
}
