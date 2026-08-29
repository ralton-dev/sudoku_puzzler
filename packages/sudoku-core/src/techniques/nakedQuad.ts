/**
 * Technique 12 — **Naked Quads**, the size-4 member of SOTD's Naked
 * Pairs/Triples family (https://www.sudokuoftheday.com/techniques/naked-pairs-triples,
 * read 2026-08-29). SOTD writes the family up at sizes two and three — "you can
 * be sure that between them, they only contain 1 and 5 ... so you can remove 1
 * and 5 as candidates from all of the other cells in the area!" — and the
 * argument does not care about the size: four cells in a unit holding nothing
 * but four digits between them own those four digits, so the digits come out of
 * the rest of the unit. Decision 16 lists it separately at 5000 first, 4000
 * subsequently, which is why it is its own rung rather than a parameter.
 *
 * As with the triple, members need not be complete: `{12} {23} {34} {14}` is a
 * quad on {1,2,3,4} just as much as four cells each holding all four. A member
 * with a single candidate is a Single Candidate, cheaper on the ladder, so
 * members hold two to four candidates.
 *
 * ## Scan order (deterministic — WP-T1 re-validates against it)
 *
 * Units in `UNITS` order (rows 0..8, then columns 9..17, then boxes 18..26),
 * and inside a unit cell quadruples in ascending lexicographic order. The first
 * one that removes at least one candidate is the step; a genuine quad that
 * eliminates nothing is skipped, because a step must change something. See
 * `subsets.ts`, which holds the shared search.
 */

import type { Step } from '../types.js';
import type { TechniqueState } from './state.js';
import { findNakedSubset } from './subsets.js';

export function nakedQuad(state: TechniqueState): Step | null {
  return findNakedSubset(state, 4, 'nakedQuad', 'quad');
}
