/**
 * Technique 8 — SOTD's **Naked Triples** (the triple half of
 * https://www.sudokuoftheday.com/techniques/naked-pairs-triples, read
 * 2026-08-29): "Can you spot that {569} occurs three times? That means that the
 * values 5,6,9 exist in only those three cells - and can't exist in any of the
 * other cells." SOTD is explicit that the members need not be complete: "The
 * trick is to look for cells which only contain values out of those three
 * candidates", and their tip covers `{24} {47} {27}` too. So a member holds any
 * two or three of the three digits and nothing else.
 *
 * Decision 16 costs it 2000 first, 1400 subsequently.
 *
 * ## Scan order (deterministic — WP-T1 re-validates against it)
 *
 * Units in `UNITS` order (rows, then columns, then boxes), and inside a unit
 * cell triples in ascending lexicographic order. See `subsets.ts`, which holds
 * the shared search.
 */

import type { Step } from '../types.js';
import type { TechniqueState } from './state.js';
import { findNakedSubset } from './subsets.js';

export function nakedTriple(state: TechniqueState): Step | null {
  return findNakedSubset(state, 3, 'nakedTriple', 'triple');
}
