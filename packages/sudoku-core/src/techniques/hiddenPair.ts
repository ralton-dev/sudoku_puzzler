/**
 * Technique 7 — SOTD's **Hidden Pairs** (the pair half of
 * https://www.sudokuoftheday.com/techniques/hidden-pairs-triples, read
 * 2026-08-29): "Because 1 and 3 can only exist in two of those cells (no other
 * cells will accept either of them), that means they must be in those two
 * cells, leaving no room for any other ... you can remove it as a candidate
 * from the end cell!"
 *
 * Decision 16 costs it 1500 first, 1200 subsequently.
 *
 * ## Scan order (deterministic — WP-T1 re-validates against it)
 *
 * Units in `UNITS` order (rows, then columns, then boxes), and inside a unit
 * digit pairs in ascending order. See `subsets.ts`, which holds the shared
 * search.
 */

import type { Step } from '../types.js';
import type { TechniqueState } from './state.js';
import { findHiddenSubset } from './subsets.js';

export function hiddenPair(state: TechniqueState): Step | null {
  return findHiddenSubset(state, 2, 'hiddenPair', 'pair');
}
