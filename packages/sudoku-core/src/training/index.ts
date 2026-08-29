/**
 * The committed training content (decision 18): real positions mined off the
 * generator by `mine.ts`, plus the names and costs the training UI labels each
 * technique with.
 *
 * Nothing here computes anything. `examples.json` is data checked into the
 * repo, and this file is the typed door onto it, so the browser can render a
 * technique's example without a solver, a network call or a server route —
 * WP-T2 imports `TRAINING_EXAMPLES` and `TECHNIQUE_META` straight from
 * `sudoku-core` through the workspace.
 *
 * ## Rebuilding the position a step was found in
 *
 * `TrainingExample` stores `{ grid, eliminated }`, which is exactly
 * `createState`'s contract (see `techniques/state.ts`): naive candidates from
 * `grid`, then the recorded `eliminated` ledger replayed. That ledger is what
 * the *cheaper* steps before this one had already ruled out, and it is what
 * makes the example honest — the technique fires on this position only because
 * those eliminations are in place.
 *
 *   const state = createState(parseGrid(ex.grid), ex.eliminated);
 *   expect(TECHNIQUES[ex.technique](state)).toEqual(ex.step);
 *
 * `examples.test.ts` runs precisely that over every example, which is what
 * keeps the JSON honest when a technique's scan order changes: the file stops
 * matching and has to be re-mined, rather than quietly teaching a step the
 * library would no longer take.
 *
 * ## Ordering
 *
 * `examples.json` is sorted by technique in `TECHNIQUE_IDS` (ladder) order,
 * then by the seed the position came from. The seed is not a `TrainingExample`
 * field — `types.ts` is frozen and it is of no use to the UI — so the test can
 * only assert the ladder-order grouping; the secondary key is the miner's, and
 * `mine.ts` documents it.
 */

import type { TechniqueId, TrainingExample } from '../types.js';

/**
 * The import attribute is not decoration. Without `with { type: 'json' }` this
 * module loads under every bundler in the repo and fails under plain Node ESM
 * with `ERR_IMPORT_ATTRIBUTE_MISSING` — which is how WP-G found it, loading the
 * built barrel unbundled from an e2e. `sudoku-core` is a library and has to be
 * loadable that way, so the attribute stays. It is transparent to the rest of
 * the toolchain: `tsc` preserves it in the emit, and Vite, esbuild and Vitest
 * all produce byte-identical output with and without it.
 */
import examples from './examples.json' with { type: 'json' };

/**
 * Every mined position, at most `EXAMPLES_PER_TECHNIQUE` per technique.
 *
 * The cast is the JSON import's: TypeScript widens `"nakedSingle"` in a `.json`
 * file to `string`, and there is no way to annotate a JSON literal. The
 * assertion is not taken on trust — `examples.test.ts` re-runs every example
 * through the real technique, which would fail long before a bad `technique`
 * string mattered.
 */
export const TRAINING_EXAMPLES: readonly TrainingExample[] = examples as TrainingExample[];

/** How a technique is named and priced in the training UI. */
export interface TechniqueMeta {
  /** our display name, the one the training index lists */
  name: string;
  /** sudokuoftheday.com's name for the same technique (decision 16's table) */
  sotdName: string;
  /** decision 16's `[first use, every subsequent use]` cost */
  cost: [number, number];
}

/**
 * Names and costs for all fourteen techniques.
 *
 * The costs are decision 16's, written out here rather than imported from
 * `techniques/index.ts` so that a page of training prose does not drag the
 * whole ladder into the client bundle. `examples.test.ts` asserts every tuple
 * equals `COSTS`, so the two cannot drift.
 */
export const TECHNIQUE_META: Readonly<Record<TechniqueId, TechniqueMeta>> = {
  nakedSingle: { name: 'Naked Single', sotdName: 'Single Candidate', cost: [100, 100] },
  hiddenSingle: { name: 'Hidden Single', sotdName: 'Single Position', cost: [100, 100] },
  candidateLines: { name: 'Candidate Lines', sotdName: 'Candidate Lines', cost: [350, 200] },
  doublePairs: { name: 'Double Pairs', sotdName: 'Double Pairs', cost: [500, 250] },
  multipleLines: { name: 'Multiple Lines', sotdName: 'Multiple Lines', cost: [700, 400] },
  nakedPair: { name: 'Naked Pair', sotdName: 'Naked Pair', cost: [750, 500] },
  hiddenPair: { name: 'Hidden Pair', sotdName: 'Hidden Pair', cost: [1500, 1200] },
  nakedTriple: { name: 'Naked Triple', sotdName: 'Naked Triple', cost: [2000, 1400] },
  hiddenTriple: { name: 'Hidden Triple', sotdName: 'Hidden Triple', cost: [2400, 1600] },
  xWing: { name: 'X-Wing', sotdName: 'X-Wing', cost: [2800, 1600] },
  forcingChains: { name: 'Forcing Chains', sotdName: 'Forcing Chains', cost: [4200, 2100] },
  nakedQuad: { name: 'Naked Quad', sotdName: 'Naked Quad', cost: [5000, 4000] },
  hiddenQuad: { name: 'Hidden Quad', sotdName: 'Hidden Quad', cost: [7000, 5000] },
  swordfish: { name: 'Swordfish', sotdName: 'Swordfish', cost: [8000, 6000] },
};

/** The examples for one technique, in the order `examples.json` stores them. */
export function examplesFor(technique: TechniqueId): TrainingExample[] {
  return TRAINING_EXAMPLES.filter((example) => example.technique === technique);
}
