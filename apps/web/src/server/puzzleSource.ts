/**
 * Where a new game's puzzle comes from.
 *
 * The routes never call the core library directly — they call an injected
 * `PuzzleSource`. That is what lets a test pick its puzzles without waiting on
 * the generator, and it is what makes the dev-only `SUDOKU_FIXTURE` hook a swap
 * of one object rather than a branch inside a route. `generate()` is real for
 * all six levels now; the injection point stays because a test that wants a
 * *known* puzzle still should not have to generate one.
 */

import type { Level } from 'sudoku-core';
import { countSolutions, formatGrid, generate, isComplete, parseGrid } from 'sudoku-core';
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

/** Why a puzzle may not be persisted (decision 5). */
export interface PuzzleRejection {
  reason: 'not-unique' | 'solution-mismatch' | 'malformed';
  detail: string;
}

/**
 * Decision 5, enforced on the *insert* path rather than trusted.
 *
 * A puzzle with more than one solution is the plan's named regression: the
 * completion check compares against the **stored** solution, so a second valid
 * fill would be reported back to the user as `wrongCells` — the app telling a
 * correct solver they are wrong. Decision 5 says such a puzzle is never
 * persisted, so this runs before the row is written, on whatever the puzzle
 * source produced, generator or fixture alike. `countSolutions(g, 2)` costs
 * well under a millisecond (WP-B), so there is no reason to skip it.
 *
 * Returns `null` when the puzzle is servable, or why it is not.
 */
export function checkServable(puzzle: ServerPuzzle): PuzzleRejection | null {
  let givens;
  let solution;
  try {
    givens = parseGrid(puzzle.givens);
    solution = parseGrid(puzzle.solution);
  } catch (error) {
    return { reason: 'malformed', detail: error instanceof Error ? error.message : String(error) };
  }

  if (!isComplete(solution)) {
    return { reason: 'solution-mismatch', detail: 'solution is not a complete valid grid' };
  }
  for (let i = 0; i < 81; i += 1) {
    const given = givens[i] as number;
    if (given !== 0 && given !== solution[i]) {
      return { reason: 'solution-mismatch', detail: `given at ${i} disagrees with the solution` };
    }
  }

  const count = countSolutions(givens, 2);
  if (count !== 1) {
    return { reason: 'not-unique', detail: `countSolutions(givens, 2) = ${count}, want 1` };
  }
  return null;
}

/** Throwing form, for boot-time paths where there is no request to answer. */
export function assertServable(puzzle: ServerPuzzle): ServerPuzzle {
  const rejection = checkServable(puzzle);
  if (rejection) {
    throw new Error(`refusing to persist a ${puzzle.level} puzzle: ${rejection.detail}`);
  }
  return puzzle;
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
