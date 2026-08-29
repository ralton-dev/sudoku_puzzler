import { describe, expect, it } from 'vitest';
import { KNOWN_BY_LEVEL, KNOWN_PUZZLES, type KnownPuzzle } from './fixtures/known.js';
import { parseGrid } from './grid.js';
import { levelOf, rate } from './rater.js';
import { COSTS, LADDER, MAX_CHAIN_DEPTH } from './techniques/index.js';
import type { Rating, TechniqueId } from './types.js';

/**
 * # Calibration: our decision-16 score against sudokuoftheday.com's own
 *
 * The six `fixtures/known.ts` puzzles are SOTD's dailies of 2026-08-29 with
 * SOTD's published score. This file is the oracle WP-D2 owes: all six rated by
 * the complete fourteen-rung ladder, our number beside theirs, and the delta.
 *
 * Measured on this Mac, node 22, `pnpm vitest run --project sudoku-core`
 * (`rate()` is the best of five runs after a warm-up):
 *
 * | fixture    | SOTD score | SOTD's band | our score | our band   | delta | rate() |
 * | ---------- | ---------- | ----------- | --------- | ---------- | ----- | ------ |
 * | beginner   |       4200 | beginner    |      4200 | beginner   |     0 | 0.17ms |
 * | easy       |       5000 | easy        |      5000 | easy       |     0 | 0.14ms |
 * | medium     |       6450 | medium      |      6450 | medium     |     0 | 0.31ms |
 * | tricky     |       8750 | fiendish    |      8950 | fiendish   |  +200 | 0.53ms |
 * | fiendish   |       9800 | fiendish    |      9800 | fiendish   |     0 | 0.63ms |
 * | diabolical |      12950 | diabolical  |     12750 | diabolical |  -200 | 1.11ms |
 *
 * **Four of six land on SOTD's published number exactly, and all six land in
 * the same band.** Before WP-D2 the diabolical row read `null` — the ladder
 * stalled without Forcing Chains — so completing the ladder is what turned the
 * sixth row from "no score" into "-200".
 *
 * ## "SOTD's band" is `levelOf(sotdScore)`, not SOTD's label
 *
 * This is the KNOWN DISCREPANCY at the top of `fixtures/known.ts`. SOTD's
 * published ranges overlap and decision 16 resolves the overlaps by lower
 * bound, so their *tricky* fixture at 8750 is a legitimate tricky for them
 * (their range is 6500-9300) and a legitimate fiendish for us. Asserting
 * `=== fixture.level` would be asserting that decision 16's band table equals
 * SOTD's labels, which decision 16 explicitly says it does not. So the
 * assertion below is `levelOf(ours) === levelOf(sotdScore)`: our *scoring*
 * agrees with their *scoring*.
 *
 * ## Where the two 200s come from — reported, not tuned
 *
 * Both non-zero deltas are exactly 200, which is `COSTS.candidateLines[1]`, the
 * subsequent-use cost of Candidate Lines. Our traces:
 *
 *   tricky      43 nakedSingle, 14 hiddenSingle, **2 candidateLines**,
 *               1 doublePairs, 1 multipleLines, 1 hiddenPair          = 8950
 *   diabolical  39 nakedSingle, 17 hiddenSingle, **2 candidateLines**,
 *               1 hiddenTriple, 1 forcingChains                       = 12750
 *
 * So on `tricky` our ladder reaches for Candidate Lines once more than SOTD's
 * solver did, and on `diabolical` once less. Everything else in both traces
 * charges what SOTD charges. That is a difference in *which* Candidate Lines
 * instance is available at a given moment — our scan takes the first in a fixed
 * order (`candidateLines.ts` documents it), SOTD's takes whatever theirs finds
 * — and it is not something a cost table can fix. Costs are decision 16 and are
 * not adjusted here; the test below asserts the accounting so that if either
 * delta ever moves it is visible as a changed step count, not a changed cost.
 *
 * ## What the four new rungs actually do to the six
 *
 * Only `forcingChains` fires, once, on the diabolical fixture. `nakedQuad`,
 * `hiddenQuad` and `swordfish` never fire on any of the six: they are reached
 * only when everything cheaper — Forcing Chains included — has returned `null`,
 * and on these puzzles it never does. They earn their place in `LADDER` by
 * being the difference between a stall and a score on grids the digger meets,
 * not by showing up in this table.
 */

const rated: Record<string, Rating | null> = Object.fromEntries(
  KNOWN_PUZZLES.map((f) => [f.level, rate(parseGrid(f.givens))]),
);

/** How many times each technique fired in a rating. */
function counts(rating: Rating): Partial<Record<TechniqueId, number>> {
  const out: Partial<Record<TechniqueId, number>> = {};
  for (const step of rating.steps) out[step.technique] = (out[step.technique] ?? 0) + 1;
  return out;
}

/** The score decision 16's cost table gives that exact sequence of steps. */
function scoreOf(rating: Rating): number {
  const seen = new Set<TechniqueId>();
  let total = 0;
  for (const step of rating.steps) {
    total += COSTS[step.technique][seen.has(step.technique) ? 1 : 0] as number;
    seen.add(step.technique);
  }
  return total;
}

/** Our score for each fixture, as measured above. Pinned so drift is loud. */
const OUR_SCORE: Record<KnownPuzzle['level'], number> = {
  beginner: 4200,
  easy: 5000,
  medium: 6450,
  tricky: 8950,
  fiendish: 9800,
  diabolical: 12750,
};

describe('calibration against sudokuoftheday.com', () => {
  it.each(KNOWN_PUZZLES.map((f) => [f.level, f] as const))(
    'rates the %s fixture in the same band SOTD’s own score falls in',
    (_level, fixture) => {
      const rating = rated[fixture.level];
      expect(rating).not.toBeNull();
      // NOT `=== fixture.level` — see the KNOWN DISCREPANCY note in known.ts
      expect(levelOf((rating as Rating).score)).toBe(levelOf(fixture.sotdScore));
    },
  );

  it.each(KNOWN_PUZZLES.map((f) => [f.level, f] as const))(
    'scores the %s fixture at the number in the table above',
    (_level, fixture) => {
      const rating = rated[fixture.level] as Rating;
      expect(rating.score).toBe(OUR_SCORE[fixture.level]);
      // and the score really is the cost table applied to the trace
      expect(rating.score).toBe(scoreOf(rating));
    },
  );

  it('finishes all six — the completed ladder leaves nothing stalled', () => {
    expect(KNOWN_PUZZLES.map((f) => rated[f.level] !== null)).toEqual([
      true,
      true,
      true,
      true,
      true,
      true,
    ]);
  });

  it('accounts for both 200s as one Candidate Lines, not as a cost we could tune', () => {
    const gap = COSTS.candidateLines[1];
    expect(gap).toBe(200);
    // tricky is 200 over SOTD, diabolical 200 under, and both traces charge
    // Candidate Lines exactly twice — the rung where the two solvers differ.
    expect(OUR_SCORE.tricky - KNOWN_BY_LEVEL.tricky.sotdScore).toBe(gap);
    expect(OUR_SCORE.diabolical - KNOWN_BY_LEVEL.diabolical.sotdScore).toBe(-gap);
    expect(counts(rated.tricky as Rating).candidateLines).toBe(2);
    expect(counts(rated.diabolical as Rating).candidateLines).toBe(2);
  });

  it('needed forcing chains for diabolical, and nothing above it for any of the six', () => {
    expect(counts(rated.diabolical as Rating).forcingChains).toBe(1);
    for (const fixture of KNOWN_PUZZLES) {
      const fired = counts(rated[fixture.level] as Rating);
      for (const id of ['nakedQuad', 'hiddenQuad', 'swordfish'] as const) {
        expect(fired[id]).toBeUndefined();
      }
    }
  });

  it('runs every rung of the full fourteen-rung ladder', () => {
    expect(LADDER).toHaveLength(14);
    // pinned here because raising it re-routes the diabolical solve and the
    // table above stops being true — see forcingChains.ts on the plateau
    expect(MAX_CHAIN_DEPTH).toBe(12);
  });
});
