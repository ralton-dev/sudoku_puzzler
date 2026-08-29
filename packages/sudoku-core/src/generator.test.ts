import { describe, expect, it } from 'vitest';
import {
  DEFAULT_STEP_BACK_BUDGET,
  GenerationFailed,
  RATE_AFTER_REMOVALS,
  generatePuzzle,
  shuffleGrid,
} from './generator.js';
import { emptyGrid, formatGrid, isComplete, isValidGrid, parseGrid } from './grid.js';
import { countSolutions, solveRandom } from './solver.js';
import { createRng } from './rng.js';
import { KNOWN_BY_LEVEL } from './fixtures/known.js';
import { CELL_COUNT, type Grid, type Rating } from './types.js';

/**
 * The fake rater the plan asks for: **score = 100 x empty cells**. It stands in
 * for WP-D's real ladder while keeping every property the generator actually
 * depends on — a number that rises as the grid empties, and a `null` channel for
 * "the ladder stalled". It never returns `null`, so the `null` path is exercised
 * separately by `stallingRate` below.
 *
 * `level` is a placeholder: `generatePuzzle` never reads it (it compares
 * `score` against the injected band and nothing else), which is the point of
 * decision 17's injected rater.
 */
function emptyCells(grid: Grid): number {
  let n = 0;
  for (let i = 0; i < CELL_COUNT; i++) if ((grid[i] as number) === 0) n++;
  return n;
}

const fakeRate = (grid: Grid): Rating => ({
  score: emptyCells(grid) * 100,
  level: 'medium',
  steps: [],
});

/** A rater that counts its calls and records the grids it saw. */
function countingRate(): { rate: (g: Grid) => Rating; calls: number[] } {
  const calls: number[] = [];
  return {
    rate: (grid: Grid) => {
      calls.push(emptyCells(grid));
      return fakeRate(grid);
    },
    get calls() {
      return calls;
    },
  };
}

/**
 * A band the fake rater can reach comfortably: 53..59 empty cells, i.e. 22..28
 * givens. Symmetric digging lands there for every seed tried, while still being
 * deep enough that the dig has to work for it (see the timing note below, where
 * a deeper floor starts failing). Used by most tests here so the numbers are
 * comparable.
 */
const BAND = { min: 5300, max: 5900 };

describe('shuffleGrid', () => {
  it('turns a complete grid into a different complete grid', () => {
    const solution = parseGrid(KNOWN_BY_LEVEL.medium.solution);
    const shuffled = shuffleGrid(solution, createRng(12345));

    expect(isComplete(shuffled)).toBe(true);
    expect(formatGrid(shuffled)).not.toBe(formatGrid(solution));
    expect(shuffled).not.toBe(solution);
    expect(formatGrid(solution)).toBe(KNOWN_BY_LEVEL.medium.solution); // input untouched
  });

  it('is a symmetry: every seed gives a valid complete grid', () => {
    const solution = parseGrid(KNOWN_BY_LEVEL.easy.solution);
    let distinct = 0;
    for (let seed = 0; seed < 50; seed++) {
      const shuffled = shuffleGrid(solution, createRng(seed));
      expect(isValidGrid(shuffled)).toBe(true);
      expect(isComplete(shuffled)).toBe(true);
      if (formatGrid(shuffled) !== KNOWN_BY_LEVEL.easy.solution) distinct++;
    }
    expect(distinct).toBe(50); // none of 50 seeds is the identity
  });

  it('is deterministic per seed', () => {
    const solution = parseGrid(KNOWN_BY_LEVEL.tricky.solution);
    expect(formatGrid(shuffleGrid(solution, createRng(9)))).toBe(
      formatGrid(shuffleGrid(solution, createRng(9))),
    );
  });

  it('carries empty cells through, so it works on a puzzle too', () => {
    const givens = parseGrid(KNOWN_BY_LEVEL.beginner.givens);
    const shuffled = shuffleGrid(givens, createRng(3));
    expect(isValidGrid(shuffled)).toBe(true);
    expect(emptyCells(shuffled)).toBe(emptyCells(givens));
    expect(countSolutions(shuffled, 2)).toBe(1); // a symmetry preserves uniqueness
  });
});

describe('generatePuzzle', () => {
  it('is deterministic per seed and lands inside the target band', () => {
    const opts = { seed: 7, target: BAND, rate: fakeRate };
    const a = generatePuzzle(opts);
    const b = generatePuzzle(opts);

    expect(formatGrid(a.givens)).toBe(formatGrid(b.givens));
    expect(formatGrid(a.solution)).toBe(formatGrid(b.solution));
    expect(a.stats).toEqual(b.stats);
    expect(a.score).toBe(b.score);

    expect(a.score).toBeGreaterThanOrEqual(BAND.min);
    expect(a.score).toBeLessThanOrEqual(BAND.max);
    expect(a.score).toBe(fakeRate(a.givens).score); // the score is of these givens
    expect(a.seed).toBe(7);
  });

  it('gives different puzzles for different seeds', () => {
    const one = generatePuzzle({ seed: 1, target: BAND, rate: fakeRate });
    const two = generatePuzzle({ seed: 2, target: BAND, rate: fakeRate });
    expect(formatGrid(one.givens)).not.toBe(formatGrid(two.givens));
    expect(formatGrid(one.solution)).not.toBe(formatGrid(two.solution));
  });

  it('counts step-backs and rate calls in stats', () => {
    const counting = countingRate();
    const puzzle = generatePuzzle({ seed: 4, target: BAND, rate: counting.rate });

    expect(puzzle.stats.rateCalls).toBe(counting.calls.length);
    expect(puzzle.stats.stepBacks).toBeGreaterThan(0); // digging always over-reaches
    expect(puzzle.stats.passes).toBeGreaterThanOrEqual(1);
    expect(puzzle.stats.removals).toBeGreaterThan(RATE_AFTER_REMOVALS);
    // 81 - givens, with the pairs removed in the winning pass accounting for it
    expect(emptyCells(puzzle.givens)).toBe(puzzle.score / 100);
  });

  it('does not rate anything until ~15 pairs are out', () => {
    const counting = countingRate();
    generatePuzzle({ seed: 11, target: BAND, rate: counting.rate });
    // the first rating happens on the 16th removal, so at least 16 pairs' worth
    // of cells (the centre may be one of them) are already gone
    const firstEmpty = counting.calls[0] as number;
    expect(counting.calls.length).toBeGreaterThan(0);
    expect(firstEmpty).toBeGreaterThanOrEqual(RATE_AFTER_REMOVALS * 2 + 1);
  });

  it('reverts a removal the rater cannot score (a stalled ladder)', () => {
    // Stalls once the grid is emptier than the band's floor, so the generator
    // can never finish: `null` must be treated as "revert", not "crash".
    const stallingRate = (grid: Grid): Rating | null =>
      emptyCells(grid) > 46 ? null : fakeRate(grid);
    expect(() =>
      generatePuzzle({
        seed: 5,
        target: BAND,
        rate: stallingRate,
        stepBackBudget: 40,
      }),
    ).toThrow(GenerationFailed);
  });

  it('throws GenerationFailed with the seed and the step-backs on an impossible band', () => {
    // A band no amount of digging reaches: 900 empty cells.
    let thrown: unknown;
    try {
      generatePuzzle({
        seed: 3,
        target: { min: 90_000, max: 100_000 },
        rate: fakeRate,
        stepBackBudget: 30,
      });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(GenerationFailed);
    const failure = thrown as GenerationFailed;
    expect(failure.seed).toBe(3);
    expect(failure.stepBacks).toBeGreaterThanOrEqual(30);
    expect(failure.name).toBe('GenerationFailed');
    expect(failure.message).toContain('seed 3');
  });

  it('defaults the step-back budget to 300', () => {
    expect(DEFAULT_STEP_BACK_BUDGET).toBe(300);
  });

  /**
   * The decision-5 sweep, and where the report's timings come from.
   *
   * Measured 2026-08-29, M-series Mac, node 22, fake rater
   * (score = 100 x empty cells), band 5300..5900, default budget of 300,
   * 30 seeds, all of which produced a puzzle:
   *
   *   dig time     median 2 ms, mean 2.5 ms, max 7 ms  (Date.now, 1 ms resolution)
   *   rate calls   median 12, mean 15.7, max 34
   *   step-backs   median 10, mean 13.0, max 41
   *   givens       median 28 (27..28)
   *   dig passes   median 1, max 3
   *
   * **The rate-call count is the number WP-D and WP-G budget against**: with the
   * real ladder each call is a full technique-by-technique solve, so a dig costs
   * roughly a dozen ratings plus ~40 `countSolutions` calls, not one of each.
   *
   * The cost is dominated by how deep the band's *floor* forces the dig, not by
   * its width — the loop returns the moment `score >= target.min`. Same rater,
   * 30 seeds, band `[min, min + 400]`:
   *
   *   floor 4700  0/30 fail   avg 9 rate calls    avg 3 step-backs      26 ms total
   *   floor 5300  0/30 fail   avg 16 rate calls   avg 13 step-backs     74 ms total
   *   floor 5500  0/30 fail   avg 32 rate calls   avg 32 step-backs    190 ms total
   *   floor 5600  6/30 fail   avg 145 rate calls  avg 161 step-backs  1166 ms total
   *   floor 5800 27/30 fail   avg 189 rate calls  avg 207 step-backs  1800 ms total
   *
   * i.e. a band that demands fewer than ~25 givens runs into the wall that
   * rotational symmetry puts there, and most seeds spend the budget. That is
   * exactly the case WP-D's `seed + i` retry exists for.
   */
  it('returns a unique, solution-consistent, symmetric puzzle for 30 seeds', () => {
    const times: number[] = [];
    const rateCalls: number[] = [];
    const stepBacks: number[] = [];
    const givenCounts: number[] = [];

    for (let seed = 0; seed < 30; seed++) {
      const started = Date.now();
      const puzzle = generatePuzzle({ seed, target: BAND, rate: fakeRate });
      times.push(Date.now() - started);
      rateCalls.push(puzzle.stats.rateCalls);
      stepBacks.push(puzzle.stats.stepBacks);
      givenCounts.push(CELL_COUNT - emptyCells(puzzle.givens));

      // decision 5: exactly one solution, and it is the one we dug from
      expect(countSolutions(puzzle.givens, 2)).toBe(1);
      expect(isComplete(puzzle.solution)).toBe(true);
      expect(formatGrid(solveRandom(puzzle.givens, createRng(seed)) as Grid)).toBe(
        formatGrid(puzzle.solution),
      );

      // every given agrees with the solution
      for (let i = 0; i < CELL_COUNT; i++) {
        const given = puzzle.givens[i] as number;
        if (given !== 0) expect(given).toBe(puzzle.solution[i] as number);
      }

      // decision 17: the pattern of givens is rotationally symmetric
      for (let i = 0; i < CELL_COUNT; i++) {
        expect((puzzle.givens[i] as number) === 0).toBe(
          (puzzle.givens[CELL_COUNT - 1 - i] as number) === 0,
        );
      }

      // inside the band
      expect(puzzle.score).toBeGreaterThanOrEqual(BAND.min);
      expect(puzzle.score).toBeLessThanOrEqual(BAND.max);
    }

    const median = (xs: number[]): number => {
      const sorted = [...xs].sort((a, b) => a - b);
      return sorted[Math.floor(sorted.length / 2)] as number;
    };
    // Recorded, not asserted tightly: the numbers above are the measurement,
    // this bound is only a guard against an order-of-magnitude regression.
    expect(median(times)).toBeLessThan(500);
    expect(median(rateCalls)).toBeGreaterThan(0);
    expect(median(stepBacks)).toBeGreaterThan(0);
    expect(median(givenCounts)).toBeLessThan(40);
  });

  it('starts from a full grid the seed alone determines', () => {
    // The solution is `shuffleGrid(solveRandom(empty, rng), rng)` with one rng
    // from the seed — the property WP-D's seed+i retry relies on.
    const rng = createRng(21);
    const expected = shuffleGrid(solveRandom(emptyGrid(), rng) as Grid, rng);
    const puzzle = generatePuzzle({ seed: 21, target: BAND, rate: fakeRate });
    expect(formatGrid(puzzle.solution)).toBe(formatGrid(expected));
  });
});
