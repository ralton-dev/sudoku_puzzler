/**
 * Technique 13 — **Hidden Quads**, the size-4 member of SOTD's Hidden
 * Pairs/Triples family (https://www.sudokuoftheday.com/techniques/hidden-pairs-triples,
 * read 2026-08-29): "you're looking for a group of numbers that are limited to
 * only a small group of cells ... even though there will be other candidates in
 * the same cell 'hiding' them." SOTD writes it up at sizes two and three — "For
 * triples, you'll be looking for three cells" — and the argument scales: four
 * digits that can only go in four cells of a unit fill those four cells between
 * them, so every *other* candidate in those cells can go. Decision 16 lists it
 * separately at 7000 first, 5000 subsequently.
 *
 * A digit with one place in the unit is a Single Position, cheaper on the
 * ladder, so members have two to four places.
 *
 * ## Scan order (deterministic — WP-T1 re-validates against it)
 *
 * Units in `UNITS` order (rows 0..8, then columns 9..17, then boxes 18..26),
 * and inside a unit digit quadruples in ascending order. The first one that
 * removes at least one candidate is the step; a genuine quad that eliminates
 * nothing is skipped, because a step must change something. See `subsets.ts`,
 * which holds the shared search.
 */

import type { Step } from '../types.js';
import type { TechniqueState } from './state.js';
import { findHiddenSubset } from './subsets.js';

export function hiddenQuad(state: TechniqueState): Step | null {
  return findHiddenSubset(state, 4, 'hiddenQuad', 'quad');
}
