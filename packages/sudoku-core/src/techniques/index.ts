/**
 * The ladder: which techniques exist, what they cost, and in what order the
 * rater tries them. Decision 16 is the spec; nothing here is tunable.
 *
 * ## Adding a technique (WP-D2, for 11..14)
 *
 *  1. Write `techniques/<id>.ts` exporting one `Technique` — see `state.ts` for
 *     the signature and `nakedSingle.ts` for the smallest example. Cite the
 *     sudokuoftheday.com page in the file header and **document the scan
 *     order**: a technique must return the *first* applicable instance in a
 *     fixed order, because WP-T1 re-runs it against a stored position and
 *     expects the identical `Step` back.
 *  2. Every `Step` field is filled (decision 18): `cells` is the pattern,
 *     `units` the units it spans, `placements`/`eliminations` what changes, and
 *     `reason` one sentence a learner can read. A `Step` that changes nothing
 *     is a bug — the rater throws on one rather than looping.
 *  3. Add the import and one entry to `TECHNIQUES` below, and the id to
 *     `LADDER` in cost order. `COSTS` already has all fourteen.
 *  4. Add `<id>.test.ts` with a positive and a negative case built by hand with
 *     `stateFromString` from `state.ts`.
 *
 * Naked Quad and Hidden Quad are two-liners over `findNakedSubset` /
 * `findHiddenSubset` in `subsets.ts` at size 4 — the same shape as
 * `nakedTriple.ts` and `hiddenTriple.ts`.
 */

import type { TechniqueId } from '../types.js';
import type { Technique } from './state.js';

import { nakedSingle } from './nakedSingle.js';
import { hiddenSingle } from './hiddenSingle.js';
import { candidateLines } from './candidateLines.js';
import { doublePairs } from './doublePairs.js';
import { multipleLines } from './multipleLines.js';
import { nakedPair } from './nakedPair.js';
import { hiddenPair } from './hiddenPair.js';
import { nakedTriple } from './nakedTriple.js';
import { hiddenTriple } from './hiddenTriple.js';
import { xWing } from './xWing.js';

export type { Technique, TechniqueState } from './state.js';
export {
  applyStep,
  cellName,
  cloneState,
  createState,
  eliminate,
  hasCandidate,
  place,
  placesFor,
  stateFromString,
  unitName,
} from './state.js';
export { CHUTES } from './chutes.js';
export { findHiddenSubset, findNakedSubset } from './subsets.js';

export { nakedSingle } from './nakedSingle.js';
export { hiddenSingle } from './hiddenSingle.js';
export { candidateLines } from './candidateLines.js';
export { doublePairs } from './doublePairs.js';
export { multipleLines } from './multipleLines.js';
export { nakedPair } from './nakedPair.js';
export { hiddenPair } from './hiddenPair.js';
export { nakedTriple } from './nakedTriple.js';
export { hiddenTriple } from './hiddenTriple.js';
export { xWing } from './xWing.js';

/**
 * Decision 16's cost table, verbatim and complete — all fourteen techniques,
 * including the four WP-D2 has yet to implement, because the table *is* the
 * decision. `[first use, every subsequent use]`, per rated grid.
 *
 * Costs are not to be adjusted to make a fixture land in a nicer band; if a
 * fixture disagrees with sudokuoftheday.com, the answer is in the trace.
 */
export const COSTS: Readonly<Record<TechniqueId, readonly [number, number]>> = {
  nakedSingle: [100, 100], //     1  Single Candidate
  hiddenSingle: [100, 100], //    2  Single Position
  candidateLines: [350, 200], //  3  Candidate Lines
  doublePairs: [500, 250], //     4  Double Pairs
  multipleLines: [700, 400], //   5  Multiple Lines
  nakedPair: [750, 500], //       6  Naked Pair
  hiddenPair: [1500, 1200], //    7  Hidden Pair
  nakedTriple: [2000, 1400], //   8  Naked Triple
  hiddenTriple: [2400, 1600], //  9  Hidden Triple
  xWing: [2800, 1600], //        10  X-Wing
  forcingChains: [4200, 2100], // 11  Forcing Chains   (WP-D2)
  nakedQuad: [5000, 4000], //    12  Naked Quad       (WP-D2)
  hiddenQuad: [7000, 5000], //   13  Hidden Quad      (WP-D2)
  swordfish: [8000, 6000], //    14  Swordfish        (WP-D2)
};

/**
 * The implemented techniques in cost order — the order `rate()` tries them,
 * restarting from `LADDER[0]` after every successful application.
 *
 * **Ten of the fourteen.** WP-D2 appends `forcingChains`, `nakedQuad`,
 * `hiddenQuad` and `swordfish`, in that order (their first-use costs are 4200,
 * 5000, 7000, 8000). Until then a puzzle needing one of them makes the ladder
 * stall and `rate()` returns `null`.
 */
export const LADDER = [
  'nakedSingle',
  'hiddenSingle',
  'candidateLines',
  'doublePairs',
  'multipleLines',
  'nakedPair',
  'hiddenPair',
  'nakedTriple',
  'hiddenTriple',
  'xWing',
] as const satisfies readonly TechniqueId[];

/** The function behind every id in `LADDER`. Keys and `LADDER` move together. */
export const TECHNIQUES: Readonly<Record<(typeof LADDER)[number], Technique>> = {
  nakedSingle,
  hiddenSingle,
  candidateLines,
  doublePairs,
  multipleLines,
  nakedPair,
  hiddenPair,
  nakedTriple,
  hiddenTriple,
  xWing,
};
