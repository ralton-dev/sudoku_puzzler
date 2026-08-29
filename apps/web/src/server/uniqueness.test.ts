/**
 * Decision 5 on the insert path — the plan's "regression to fear".
 *
 * The completion check compares the user's cells against the **stored**
 * solution. If a puzzle with two solutions were ever persisted, a user who
 * found the other one would be told they were wrong, with `wrongCells`
 * pointing at correct digits. So the guard is on `POST /api/game`, before the
 * row exists, and these tests hand the route a bad puzzle source on purpose.
 */

import { countSolutions, parseGrid } from 'sudoku-core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { KNOWN_BY_LEVEL } from '../../../../packages/sudoku-core/src/fixtures/known.js';
import { checkServable, type PuzzleSource, type ServerPuzzle } from './puzzleSource.js';
import { makeHarness, type Harness } from './testHarness.js';

const EASY = KNOWN_BY_LEVEL.easy;

/**
 * A real two-solution grid, not a hand-waved one: blank the four corners of a
 * rectangle whose digits form a/b over b/a. Swapping them keeps both rows and
 * both columns intact, and keeps the two boxes intact provided the two rows
 * share a band while the two columns sit in **different** stacks — if the
 * columns shared a stack all four cells would be in one box, which would mean
 * the digit `a` twice in that box, so no such rectangle exists. The swapped
 * grid is therefore a second valid solution. Found by search over the easy
 * fixture's solution, so the test carries no magic string.
 */
function twoSolutionGivens(solution: string): string {
  for (let r1 = 0; r1 < 9; r1 += 1) {
    for (let r2 = r1 + 1; r2 < 9; r2 += 1) {
      if (Math.floor(r1 / 3) !== Math.floor(r2 / 3)) continue;
      for (let c1 = 0; c1 < 9; c1 += 1) {
        for (let c2 = c1 + 1; c2 < 9; c2 += 1) {
          if (Math.floor(c1 / 3) === Math.floor(c2 / 3)) continue;
          const a = solution[r1 * 9 + c1];
          const b = solution[r1 * 9 + c2];
          if (solution[r2 * 9 + c1] !== b || solution[r2 * 9 + c2] !== a) continue;
          const chars = [...solution];
          for (const i of [r1 * 9 + c1, r1 * 9 + c2, r2 * 9 + c1, r2 * 9 + c2]) chars[i] = '0';
          return chars.join('');
        }
      }
    }
  }
  throw new Error('no swap rectangle found in the fixture solution');
}

const sourceOf = (puzzle: ServerPuzzle): PuzzleSource => ({ generate: () => puzzle });

let h: Harness;
afterEach(async () => {
  await h.close();
});

describe('checkServable', () => {
  beforeEach(async () => {
    h = await makeHarness();
  });

  it('accepts the six committed fixtures', () => {
    for (const known of Object.values(KNOWN_BY_LEVEL)) {
      expect(
        checkServable({
          level: known.level,
          givens: known.givens,
          solution: known.solution,
          seed: 0,
        }),
      ).toBeNull();
    }
  });
});

describe('POST /api/game refuses a puzzle it cannot prove unique', () => {
  it('rejects a genuine two-solution puzzle and persists nothing', async () => {
    const givens = twoSolutionGivens(EASY.solution);
    // the premise of the test, proven rather than assumed
    expect(countSolutions(parseGrid(givens), 2)).toBe(2);

    h = await makeHarness(sourceOf({ level: 'easy', givens, solution: EASY.solution, seed: 0 }));

    const res = await h.app.inject({
      method: 'POST',
      url: '/api/game',
      payload: { level: 'easy' },
    });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: 'puzzle-not-unique', reason: 'not-unique' });

    expect(h.db.prepare('SELECT count(*) AS n FROM games').get()).toEqual({ n: 0 });
    expect((await h.app.inject({ method: 'GET', url: '/api/game' })).statusCode).toBe(204);
  });

  it('rejects a solution that disagrees with the givens', async () => {
    h = await makeHarness(
      sourceOf({
        level: 'easy',
        givens: EASY.givens,
        solution: KNOWN_BY_LEVEL.medium.solution,
        seed: 0,
      }),
    );
    const res = await h.app.inject({
      method: 'POST',
      url: '/api/game',
      payload: { level: 'easy' },
    });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: 'puzzle-not-unique', reason: 'solution-mismatch' });
    expect(h.db.prepare('SELECT count(*) AS n FROM games').get()).toEqual({ n: 0 });
  });

  it('rejects a malformed grid string', async () => {
    h = await makeHarness(
      sourceOf({ level: 'easy', givens: 'x'.repeat(81), solution: EASY.solution, seed: 0 }),
    );
    const res = await h.app.inject({
      method: 'POST',
      url: '/api/game',
      payload: { level: 'easy' },
    });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: 'puzzle-not-unique', reason: 'malformed' });
    expect(h.db.prepare('SELECT count(*) AS n FROM games').get()).toEqual({ n: 0 });
  });
});
