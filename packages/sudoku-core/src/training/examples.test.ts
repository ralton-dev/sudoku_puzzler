import { describe, expect, it } from 'vitest';
import { TECHNIQUE_IDS, type TechniqueId } from '../types.js';
import { countSolutions } from '../solver.js';
import { parseGrid } from '../grid.js';
import { COSTS, TECHNIQUES, createState } from '../techniques/index.js';
import { TECHNIQUE_META, TRAINING_EXAMPLES, examplesFor } from './index.js';

/**
 * # The honesty test for `examples.json`
 *
 * `examples.json` is mined once and committed (decision 18), so nothing in the
 * normal build regenerates it. That makes it exactly the kind of file that goes
 * quietly stale: change a technique's scan order and the committed step is no
 * longer the step the library would take, but every other test still passes and
 * the training UI happily teaches a deduction the solver has stopped making.
 *
 * So the load-bearing assertion here is the round trip: rebuild the exact
 * candidate state from `{ grid, eliminated }` — `createState`'s contract, see
 * `techniques/state.ts` — run *that one technique* against it, and demand the
 * identical `Step` back. If a technique changes, this file goes red and
 * `pnpm --filter sudoku-core mine-examples` is the fix, not an edit here.
 *
 * ## The counts, and why they are exact
 *
 * `EXPECTED` is a measurement, not a target: it is what the miner found at
 * `SEEDS_PER_LEVEL = 2000` seeds a level — 10459 distinct puzzles, about two
 * minutes. Twelve techniques reach the cap of five; `swordfish` reaches five
 * only because of that seed count (six positions found in the whole run);
 * `nakedQuad` and `hiddenQuad` reach **zero**, and `mine.ts`'s "What cannot be
 * mined" section has the measurements showing why that is structural rather
 * than a matter of seeds. The plan asks for >= 3 per technique and for a
 * shortfall to be reported rather than hand-crafted around, so the two
 * assertions below say different things:
 *
 *  - `EXPECTED` is asserted **exactly**, so any drift — a technique that starts
 *    or stops firing — shows up as a changed number rather than passing
 *    silently under a `>=`.
 *  - the >= 3 rule is asserted only for the techniques that meet it, and
 *    `SHORT` names the ones that do not, so the shortfall is documented in the
 *    tree instead of only in a report.
 */

/** Mined counts per technique — measured, see the file header. */
const EXPECTED: Record<TechniqueId, number> = {
  nakedSingle: 5,
  hiddenSingle: 5,
  candidateLines: 5,
  doublePairs: 5,
  multipleLines: 5,
  nakedPair: 5,
  hiddenPair: 5,
  nakedTriple: 5,
  hiddenTriple: 5,
  xWing: 5,
  forcingChains: 5,
  nakedQuad: 0, // see mine.ts, "What cannot be mined"
  hiddenQuad: 0, // see mine.ts, "What cannot be mined"
  swordfish: 5,
};

/** Techniques the miner could not reach three distinct positions for. */
const SHORT: readonly TechniqueId[] = TECHNIQUE_IDS.filter((id) => EXPECTED[id] < 3);

describe('TRAINING_EXAMPLES', () => {
  it('has the mined number of examples for every technique', () => {
    const counts = Object.fromEntries(
      TECHNIQUE_IDS.map((id) => [id, examplesFor(id).length]),
    ) as Record<TechniqueId, number>;
    expect(counts).toEqual(EXPECTED);
    expect(TRAINING_EXAMPLES).toHaveLength(
      TECHNIQUE_IDS.reduce((sum, id) => sum + EXPECTED[id], 0),
    );
  });

  it('has at least three examples for every technique the miner could reach', () => {
    for (const id of TECHNIQUE_IDS) {
      if (SHORT.includes(id)) continue;
      expect(examplesFor(id).length).toBeGreaterThanOrEqual(3);
    }
  });

  it('is sorted by technique in ladder order', () => {
    const seen = TRAINING_EXAMPLES.map((example) => example.technique);
    const grouped = [...new Set(seen)];
    // every technique's examples are contiguous...
    expect(seen).toEqual(grouped.flatMap((id) => seen.filter((other) => other === id)));
    // ...and the groups run in TECHNIQUE_IDS order
    expect(grouped).toEqual(TECHNIQUE_IDS.filter((id) => grouped.includes(id)));
  });

  it('holds distinct positions within a technique', () => {
    for (const id of TECHNIQUE_IDS) {
      const grids = examplesFor(id).map((example) => example.grid);
      expect(new Set(grids).size).toBe(grids.length);
    }
  });

  it('re-validates: every stored step is the step its technique still returns', () => {
    for (const example of TRAINING_EXAMPLES) {
      const state = createState(parseGrid(example.grid), example.eliminated);
      expect(TECHNIQUES[example.technique](state)).toEqual(example.step);
    }
  });

  it('stores positions with exactly one solution (decision 5)', () => {
    for (const example of TRAINING_EXAMPLES) {
      expect(countSolutions(parseGrid(example.grid), 2)).toBe(1);
    }
  });

  it('records only eliminations a step actually made, on empty cells', () => {
    for (const example of TRAINING_EXAMPLES) {
      const grid = parseGrid(example.grid);
      for (const { cell, digits } of example.eliminated) {
        expect(grid[cell]).toBe(0);
        expect(digits.length).toBeGreaterThan(0);
      }
      const cells = example.eliminated.map((e) => e.cell);
      expect(cells).toEqual([...cells].sort((a, b) => a - b));
      expect(new Set(cells).size).toBe(cells.length);
    }
  });
});

describe('TECHNIQUE_META', () => {
  it('covers all fourteen techniques, in ladder order', () => {
    expect(Object.keys(TECHNIQUE_META)).toEqual([...TECHNIQUE_IDS]);
  });

  it('carries decision 16 costs, unchanged', () => {
    for (const id of TECHNIQUE_IDS) {
      expect(TECHNIQUE_META[id].cost).toEqual([...COSTS[id]]);
    }
  });

  it('names every technique for a learner and for sudokuoftheday.com', () => {
    for (const id of TECHNIQUE_IDS) {
      expect(TECHNIQUE_META[id].name.length).toBeGreaterThan(0);
      expect(TECHNIQUE_META[id].sotdName.length).toBeGreaterThan(0);
    }
  });
});
