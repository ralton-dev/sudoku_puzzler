/**
 * Where a new game's puzzle comes from.
 *
 * The routes never call the core library directly — they call an injected
 * `PuzzleSource`. That is what lets WP-E's tests run in wave 2 while
 * `generate()` is still a stub that throws `NotImplemented`, and it is what
 * makes the dev-only `SUDOKU_FIXTURE` hook a swap of one object rather than a
 * branch inside a route.
 */

import type { Grid, Level } from 'sudoku-core';
import { generate } from 'sudoku-core';
// Deep relative import on purpose: `sudoku-core`'s package `exports` map has a
// single "." entry, so `sudoku-core/fixtures/known` does not resolve, and
// adding an entry would mean editing a file this package does not own. The
// fixtures are dev/test-only here (the SUDOKU_FIXTURE hook and the tests).
import { KNOWN_BY_LEVEL } from '../../../../packages/sudoku-core/src/fixtures/known.js';

/** A puzzle in the shape the DB stores: both grids as 81-char strings. */
export interface ServerPuzzle {
  level: Level;
  /** 81 chars, '0' = empty */
  givens: string;
  /** 81 chars, no zeros */
  solution: string;
  seed: number;
}

/** Injected into `buildApp`. Plan's `{ generate }`. */
export interface PuzzleSource {
  generate(level: Level): ServerPuzzle;
}

/** `Uint8Array(81)` -> the 81-char string the contract and the DB use. */
export function formatGrid(grid: Grid): string {
  return Array.from(grid, (digit) => String(digit)).join('');
}

/** Production: the real core generator (decisions 4, 5, 17). */
export const corePuzzleSource: PuzzleSource = {
  generate(level: Level): ServerPuzzle {
    const puzzle = generate({ level, seed: Date.now() });
    return {
      level: puzzle.level,
      givens: formatGrid(puzzle.givens),
      solution: formatGrid(puzzle.solution),
      seed: puzzle.seed,
    };
  },
};

/**
 * Dev and test: the six committed sudokuoftheday.com fixtures, one per level.
 * The requested level always gets its own fixture, so every level is playable
 * with the hook on.
 */
export const fixturePuzzleSource: PuzzleSource = {
  generate(level: Level): ServerPuzzle {
    const known = KNOWN_BY_LEVEL[level];
    return { level, givens: known.givens, solution: known.solution, seed: 0 };
  },
};
