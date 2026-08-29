import { describe, expect, it } from 'vitest';
import { countSolutions, solve, solveRandom } from './solver.js';
import { emptyGrid, formatGrid, isComplete, isValidGrid, parseGrid } from './grid.js';
import { KNOWN_BY_LEVEL, KNOWN_PUZZLES } from './fixtures/known.js';
import { createRng } from './rng.js';
import { CELL_COUNT, LEVELS } from './types.js';

/**
 * A 17-clue puzzle chosen because it is the pathological case for a naive
 * left-to-right backtracker: the top-left corner is almost empty, so an
 * in-order search explores an enormous tree before the first contradiction.
 * With MRV it is unremarkable. Its solution is checked below rather than
 * hard-coded, so the test cannot pass by agreeing with a wrong constant.
 */
const HARD_17 = '000000010400000000020000000000050407008000300001090000300400200050100000000806000';

/**
 * The beginner fixture's solution with an unavoidable set punched out: r0c1,
 * r0c4, r1c1, r1c4 held 2/5 and 5/2, four cells in two rows, two columns and
 * two boxes. Either assignment of the pair is legal, so exactly two solutions
 * remain — the classic way a puzzle silently stops being unique (decision 5).
 */
const TWO_SOLUTIONS =
  '607108394904703618183964752872431965469572183531896427246389571718645239395217846';

describe('solve', () => {
  it.each(LEVELS)('solves the %s fixture to its published solution', (level) => {
    const puzzle = KNOWN_BY_LEVEL[level];
    const solved = solve(parseGrid(puzzle.givens));
    expect(solved).not.toBeNull();
    expect(formatGrid(solved as Uint8Array)).toBe(puzzle.solution);
  });

  it('leaves the input grid untouched', () => {
    const givens = parseGrid(KNOWN_BY_LEVEL.medium.givens);
    const before = formatGrid(givens);
    solve(givens);
    expect(formatGrid(givens)).toBe(before);
  });

  it('returns the grid itself when it is already complete', () => {
    const solution = KNOWN_BY_LEVEL.easy.solution;
    expect(formatGrid(solve(parseGrid(solution)) as Uint8Array)).toBe(solution);
  });

  it('returns null for a duplicate in a row', () => {
    // r0c0 and r0c8 both hold 5.
    const grid = emptyGrid();
    grid[0] = 5;
    grid[8] = 5;
    expect(isValidGrid(grid)).toBe(false);
    expect(solve(grid)).toBeNull();
  });

  it('returns null for a duplicate in a column and in a box', () => {
    const col = emptyGrid();
    col[0] = 5;
    col[72] = 5;
    expect(solve(col)).toBeNull();

    const box = emptyGrid();
    box[0] = 5;
    box[10] = 5;
    expect(solve(box)).toBeNull();
  });

  it('returns null for a grid that is valid but has no completion', () => {
    // Row 0 = 1..8 then empty; column 8 carries the 9, so r0c8 has nowhere to go.
    const grid = emptyGrid();
    for (let c = 0; c < 8; c++) grid[c] = c + 1;
    grid[9 * 4 + 8] = 9;
    expect(isValidGrid(grid)).toBe(true);
    expect(solve(grid)).toBeNull();
  });

  it('fills an empty grid with a valid complete board', () => {
    const solved = solve(emptyGrid());
    expect(solved).not.toBeNull();
    expect(isComplete(solved as Uint8Array)).toBe(true);
  });
});

describe('countSolutions', () => {
  it.each(LEVELS)('finds exactly one solution for the %s fixture', (level) => {
    expect(countSolutions(parseGrid(KNOWN_BY_LEVEL[level].givens), 2)).toBe(1);
  });

  it('finds two for a grid with an unavoidable set', () => {
    const grid = parseGrid(TWO_SOLUTIONS);
    expect(countSolutions(grid, 2)).toBe(2);
    // and still 2 when allowed to look further — there are no more
    expect(countSolutions(grid, 10)).toBe(2);
  });

  it('finds zero for an invalid grid and for an unsolvable one', () => {
    const dup = emptyGrid();
    dup[0] = 5;
    dup[8] = 5;
    expect(countSolutions(dup, 2)).toBe(0);

    const stuck = emptyGrid();
    for (let c = 0; c < 8; c++) stuck[c] = c + 1;
    stuck[9 * 4 + 8] = 9;
    expect(countSolutions(stuck, 2)).toBe(0);
  });

  it('stops at the limit', () => {
    expect(countSolutions(emptyGrid(), 1)).toBe(1);
    expect(countSolutions(emptyGrid(), 5)).toBe(5);
    expect(countSolutions(emptyGrid(), 0)).toBe(0);
  });

  it('leaves the input grid untouched', () => {
    const grid = parseGrid(TWO_SOLUTIONS);
    countSolutions(grid, 2);
    expect(formatGrid(grid)).toBe(TWO_SOLUTIONS);
  });

  // MEASURED 2026-08-29 on this Mac (Darwin 25.3.0 arm64, Node 22, vitest 2.1.9):
  // 0.168 ms mean over 1000 runs — MRV fills a first board and then only has to
  // walk back far enough to vary one cell. The plan's budget is 50 ms, ~300x
  // headroom; the assertion exists to catch a future rewrite that starts
  // enumerating boards instead of stopping at the limit.
  it('reaches a second solution on an empty grid in under 50 ms', () => {
    const started = Date.now();
    expect(countSolutions(emptyGrid(), 2)).toBe(2);
    expect(Date.now() - started).toBeLessThan(50);
  });
});

describe('the 17-clue brute-force worst case', () => {
  it('has 17 clues and one solution', () => {
    expect([...HARD_17].filter((c) => c !== '0')).toHaveLength(17);
    expect(countSolutions(parseGrid(HARD_17), 2)).toBe(1);
  });

  // MEASURED 2026-08-29 on this Mac (Darwin 25.3.0 arm64, Node 22, vitest 2.1.9),
  // mean over 200 runs after a warm-up call:
  //   solve(HARD_17)                 6.410 ms
  //   countSolutions(HARD_17, 2)     8.575 ms   (the uniqueness proof above)
  // The plan's budget is 200 ms, so ~30x headroom. For scale, the six fixtures
  // solve in 0.026-0.194 ms each (0.560 ms for all six) — this puzzle is ~30x
  // the worst fixture, which is the whole reason it is here.
  it('solves in under 200 ms', () => {
    const started = Date.now();
    const solved = solve(parseGrid(HARD_17));
    const elapsed = Date.now() - started;

    expect(solved).not.toBeNull();
    const grid = solved as Uint8Array;
    expect(isComplete(grid)).toBe(true);
    const givens = parseGrid(HARD_17);
    for (let i = 0; i < CELL_COUNT; i++) {
      const given = givens[i] as number;
      if (given !== 0) expect(grid[i]).toBe(given);
    }
    expect(elapsed).toBeLessThan(200);
  });
});

describe('solveRandom', () => {
  it('fills an empty grid with a valid complete board', () => {
    const solved = solveRandom(emptyGrid(), createRng(7));
    expect(solved).not.toBeNull();
    expect(isComplete(solved as Uint8Array)).toBe(true);
  });

  it('is deterministic: two rngs with the same seed give the same board', () => {
    const a = solveRandom(emptyGrid(), createRng(12345));
    const b = solveRandom(emptyGrid(), createRng(12345));
    expect(formatGrid(a as Uint8Array)).toBe(formatGrid(b as Uint8Array));
  });

  it('gives a different board for a different seed', () => {
    const a = solveRandom(emptyGrid(), createRng(1));
    const b = solveRandom(emptyGrid(), createRng(2));
    expect(formatGrid(a as Uint8Array)).not.toBe(formatGrid(b as Uint8Array));
  });

  it('spreads over many boards, not a handful', () => {
    const boards = new Set<string>();
    for (let seed = 0; seed < 25; seed++) {
      const solved = solveRandom(emptyGrid(), createRng(seed));
      expect(isComplete(solved as Uint8Array)).toBe(true);
      boards.add(formatGrid(solved as Uint8Array));
    }
    expect(boards.size).toBe(25);
  });

  it('respects the givens it is handed and agrees with solve when unique', () => {
    for (const puzzle of KNOWN_PUZZLES) {
      const solved = solveRandom(parseGrid(puzzle.givens), createRng(99));
      expect(formatGrid(solved as Uint8Array)).toBe(puzzle.solution);
    }
  });

  it('returns null for an unsolvable grid', () => {
    const dup = emptyGrid();
    dup[0] = 5;
    dup[8] = 5;
    expect(solveRandom(dup, createRng(1))).toBeNull();
  });

  it('leaves the input grid untouched', () => {
    const givens = parseGrid(KNOWN_BY_LEVEL.tricky.givens);
    solveRandom(givens, createRng(3));
    expect(formatGrid(givens)).toBe(KNOWN_BY_LEVEL.tricky.givens);
  });
});
