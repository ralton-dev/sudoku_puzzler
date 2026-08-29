/**
 * Technique 1 — SOTD calls this **Single Candidate**
 * (https://www.sudokuoftheday.com/techniques/single-candidate, read 2026-08-29):
 * "if there's only one possible value for a square, that value must go there."
 * Decision 16 costs it 100 first and 100 subsequently.
 *
 * ## Scan order (deterministic — WP-T1 re-validates against it)
 *
 * Cells 0 -> 80 ascending. The first empty cell whose candidate mask holds
 * exactly one digit is the step. Nothing else is looked at.
 */

import { CELL_COUNT, type Step } from '../types.js';
import { lowestDigit, popcount } from '../grid.js';
import { type TechniqueState, cellName, unitsOfCell } from './state.js';

export function nakedSingle(state: TechniqueState): Step | null {
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    if ((state.grid[cell] as number) !== 0) continue;
    const mask = state.cand[cell] as number;
    if (popcount(mask) !== 1) continue;
    const digit = lowestDigit(mask);
    return {
      technique: 'nakedSingle',
      cells: [cell],
      units: unitsOfCell(cell),
      placements: [{ cell, digit }],
      eliminations: [],
      reason: `${cellName(cell)} has only one candidate left, so it must be ${digit}.`,
    };
  }
  return null;
}
