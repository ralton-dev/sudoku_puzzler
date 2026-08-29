/**
 * Technique 6 — SOTD's **Naked Pairs** (the pair half of
 * https://www.sudokuoftheday.com/techniques/naked-pairs-triples, read
 * 2026-08-29): "You should see the pair {15} in two places ... you can be sure
 * that between them, they only contain 1 and 5 ... so you can remove 1 and 5 as
 * candidates from all of the other cells in the area!"
 *
 * Decision 16 costs it 750 first, 500 subsequently.
 *
 * ## Scan order (deterministic — WP-T1 re-validates against it)
 *
 * Units in `UNITS` order (rows, then columns, then boxes), and inside a unit
 * cell pairs in ascending lexicographic order. See `subsets.ts`, which holds
 * the shared search.
 */

import type { Step } from '../types.js';
import type { TechniqueState } from './state.js';
import { findNakedSubset } from './subsets.js';

export function nakedPair(state: TechniqueState): Step | null {
  return findNakedSubset(state, 2, 'nakedPair', 'pair');
}
