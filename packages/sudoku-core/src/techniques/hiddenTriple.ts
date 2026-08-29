/**
 * Technique 9 — SOTD's **Hidden Triples** (the triple half of
 * https://www.sudokuoftheday.com/techniques/hidden-pairs-triples, read
 * 2026-08-29): "you're looking for a group of numbers that are limited to only
 * a small group of cells ... For triples, you'll be looking for three cells."
 * As with the hidden pair, the members are hidden behind other candidates in
 * the same cells, and it is those other candidates that get removed.
 *
 * Decision 16 costs it 2400 first, 1600 subsequently.
 *
 * ## Scan order (deterministic — WP-T1 re-validates against it)
 *
 * Units in `UNITS` order (rows, then columns, then boxes), and inside a unit
 * digit triples in ascending order. See `subsets.ts`, which holds the shared
 * search.
 */

import type { Step } from '../types.js';
import type { TechniqueState } from './state.js';
import { findHiddenSubset } from './subsets.js';

export function hiddenTriple(state: TechniqueState): Step | null {
  return findHiddenSubset(state, 3, 'hiddenTriple', 'triple');
}
