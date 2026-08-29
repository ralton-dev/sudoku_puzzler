/**
 * The ladder: which techniques exist, what they cost, and in what order the
 * rater tries them. Decision 16 is the spec; nothing here is tunable.
 *
 * ## Adding a technique
 *
 * All fourteen are implemented (WP-D landed 1..10, WP-D2 landed 11..14), so
 * this recipe is here for the fifteenth, should decision 16 ever grow one.
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
 * `nakedQuad.ts` and `hiddenQuad.ts` are two-liners over `findNakedSubset` /
 * `findHiddenSubset` in `subsets.ts` at size 4, `swordfish.ts` is `xWing.ts`
 * widened by a line, and `forcingChains.ts` is the odd one out — it reasons
 * forwards instead of pattern-matching, and its header is worth reading before
 * touching it.
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
import { forcingChains } from './forcingChains.js';
import { nakedQuad } from './nakedQuad.js';
import { hiddenQuad } from './hiddenQuad.js';
import { swordfish } from './swordfish.js';

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
export { MAX_CHAIN_DEPTH, forcingChains } from './forcingChains.js';
export { nakedQuad } from './nakedQuad.js';
export { hiddenQuad } from './hiddenQuad.js';
export { swordfish } from './swordfish.js';

/**
 * Decision 16's cost table, verbatim and complete — all fourteen techniques,
 * every one of them now on `LADDER`, because the table *is* the decision.
 * `[first use, every subsequent use]`, per rated grid.
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
  forcingChains: [4200, 2100], // 11  Forcing Chains
  nakedQuad: [5000, 4000], //    12  Naked Quad
  hiddenQuad: [7000, 5000], //   13  Hidden Quad
  swordfish: [8000, 6000], //    14  Swordfish
};

/**
 * The implemented techniques in cost order — the order `rate()` tries them,
 * restarting from `LADDER[0]` after every successful application.
 *
 * **All fourteen**, as of WP-D2. `LADDER` is now the whole of `TECHNIQUE_IDS`,
 * which is what `index.test.ts` asserts, so `rate()` returning `null` no longer
 * means "a technique is missing" — it means the puzzle genuinely needs a guess
 * (decision 16) and is never served.
 *
 * The four WP-D2 rungs sit above `xWing` in first-use cost order — 4200, 5000,
 * 7000, 8000 — and the restart-from-the-top rule is what keeps them cheap to
 * have: they are only ever *reached* at a position where all ten cheaper
 * techniques returned `null`, and after any of them fires the next iteration
 * starts again at `nakedSingle`.
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
  'forcingChains',
  'nakedQuad',
  'hiddenQuad',
  'swordfish',
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
  forcingChains,
  nakedQuad,
  hiddenQuad,
  swordfish,
};
