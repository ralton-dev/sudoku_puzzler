/**
 * The assumption to hunt for: **the board is not empty when the app loads.**
 *
 * These tests never build the state up through the API. They put a
 * half-finished board — pencil marks, a wrong digit, an hour on the clock —
 * into the database and then ask the server for it, which is what a browser
 * reload actually does.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ActiveGame, CellState } from '../shared/api.js';
import { KNOWN_BY_LEVEL } from '../../../../packages/sudoku-core/src/fixtures/known.js';
import { AWKWARD_ELAPSED_MS, buildAwkwardState, seedAwkwardGame } from './awkward.js';
import { insertGame } from './games.js';
import { cellsFrom, makeHarness, type Harness } from './testHarness.js';

const boxOf = (index: number): number =>
  Math.floor(Math.floor(index / 9) / 3) * 3 + Math.floor((index % 9) / 3);

let h: Harness;
beforeEach(async () => {
  h = await makeHarness();
});
afterEach(async () => {
  await h.close();
});

describe('the awkward fixture', () => {
  it('is one cell from complete, with one wrong digit and six marks in that box', () => {
    const state = buildAwkwardState();

    const empty = state.cells.flatMap((cell, i) => (cell.value === 0 ? [i] : []));
    expect(empty).toEqual([state.emptyCell]);

    const wrong = state.cells.flatMap((cell, i) =>
      cell.value !== 0 && cell.value !== state.solution.charCodeAt(i) - 48 ? [i] : [],
    );
    expect(wrong).toEqual([state.wrongCell]);

    const marks = state.cells.flatMap((cell, i) => cell.marks.map((mark) => ({ i, mark })));
    expect(marks).toHaveLength(6);
    const box = boxOf(state.emptyCell);
    for (const { i } of marks) expect(boxOf(i)).toBe(box);
    expect(boxOf(state.wrongCell)).toBe(box);

    expect(state.elapsedMs).toBe(AWKWARD_ELAPSED_MS);
    expect(state.elapsedMs).toBeGreaterThan(60 * 60 * 1000);
  });

  it('comes back from GET /api/game exactly as it was seeded', async () => {
    expect(seedAwkwardGame(h.db)).toBe(true);
    const state = buildAwkwardState();

    const res = await h.app.inject({ method: 'GET', url: '/api/game' });
    expect(res.statusCode).toBe(200);
    const game = res.json<ActiveGame>();
    expect(game.givens).toBe(state.givens);
    expect(game.elapsedMs).toBe(AWKWARD_ELAPSED_MS);
    expect(game.cells).toEqual(state.cells);
  });

  it('does not displace a game that is already active (decision 8: no abandon)', async () => {
    const created = await h.app.inject({
      method: 'POST',
      url: '/api/game',
      payload: { level: 'medium' },
    });
    expect(created.statusCode).toBe(201);
    expect(seedAwkwardGame(h.db)).toBe(false);
    expect((await h.app.inject({ method: 'GET', url: '/api/game' })).json<ActiveGame>().level).toBe(
      'medium',
    );
  });

  it('reports the wrong cell and the hole on complete, then completes once fixed', async () => {
    seedAwkwardGame(h.db);
    const state = buildAwkwardState();

    const refused = await h.app.inject({ method: 'POST', url: '/api/game/complete' });
    expect(refused.statusCode).toBe(409);
    expect(refused.json()).toEqual({
      error: 'not-solved',
      wrongCells: [state.emptyCell, state.wrongCell].sort((a, b) => a - b),
    });

    // The client fixes both cells and keeps its marks — completion must not
    // care about pencil marks, only values.
    const fixed = cellsFrom(state.solution);
    (fixed[state.emptyCell] as CellState).marks = [1, 2, 3];
    await h.app.inject({
      method: 'PUT',
      url: '/api/game/progress',
      payload: { cells: fixed, elapsedMs: AWKWARD_ELAPSED_MS + 5000 },
    });

    const done = await h.app.inject({ method: 'POST', url: '/api/game/complete' });
    expect(done.statusCode).toBe(200);
    expect(done.json<{ elapsedMs: number }>().elapsedMs).toBe(AWKWARD_ELAPSED_MS + 5000);
  });
});

describe('a half-finished game loaded cold', () => {
  it('is returned verbatim — marks, wrong digits, elapsed and all', async () => {
    const easy = KNOWN_BY_LEVEL.easy;
    const cells = cellsFrom(easy.givens);
    (cells[1] as CellState).value = 9;
    (cells[1] as CellState).marks = [3, 6];
    (cells[5] as CellState).marks = [1, 2, 4, 8];
    (cells[80] as CellState).value = 0;

    insertGame(h.db, {
      id: 'half-finished',
      level: 'easy',
      givens: easy.givens,
      solution: easy.solution,
      seed: 0,
      cells,
      elapsedMs: 5_400_123,
      startedAt: '2026-08-29T09:00:00.000Z',
    });

    const game = (await h.app.inject({ method: 'GET', url: '/api/game' })).json<ActiveGame>();
    expect(game).toEqual({
      id: 'half-finished',
      level: 'easy',
      givens: easy.givens,
      cells,
      elapsedMs: 5_400_123,
      startedAt: '2026-08-29T09:00:00.000Z',
    });
  });
});
