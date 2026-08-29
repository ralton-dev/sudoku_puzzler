/**
 * Technique 2 — SOTD calls this **Single Position**
 * (https://www.sudokuoftheday.com/techniques/single-position, read 2026-08-29):
 * look along a row, column or box for a value that has only one square left it
 * can go in. Decision 16 costs it 100 first and 100 subsequently.
 *
 * ## Scan order (deterministic — WP-T1 re-validates against it)
 *
 * Units in `UNITS` order — rows 0..8, then columns 9..17, then boxes 18..26 —
 * and inside each unit digits 1 -> 9. The first (unit, digit) pair with exactly
 * one candidate cell is the step.
 *
 * A digit already placed in the unit has no candidate cells there (peer
 * elimination removed it), so it can never be picked up by mistake.
 */

import type { Step } from '../types.js';
import { UNITS } from '../grid.js';
import { type TechniqueState, cellName, placesFor, unitName } from './state.js';

export function hiddenSingle(state: TechniqueState): Step | null {
  for (let u = 0; u < UNITS.length; u++) {
    const unit = UNITS[u] as readonly number[];
    for (let digit = 1; digit <= 9; digit++) {
      const places = placesFor(state, unit, digit);
      if (places.length !== 1) continue;
      const cell = places[0] as number;
      return {
        technique: 'hiddenSingle',
        cells: [cell],
        units: [u],
        placements: [{ cell, digit }],
        eliminations: [],
        reason: `${cellName(cell)} is the only square in ${unitName(u)} that can still take a ${digit}.`,
      };
    }
  }
  return null;
}
