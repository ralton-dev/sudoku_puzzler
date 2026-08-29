/**
 * The five routes against a real SQLite file, through `app.inject`.
 *
 * Every test here injects the fixture puzzle source rather than calling the
 * real `generate()`: these tests are about the routes, and a route test that
 * generated a fresh puzzle would be asserting against a puzzle it does not
 * know. The real generator is exercised end to end in `apps/web/e2e`.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ActiveGame, CellState, HistoryEntry } from '../shared/api.js';
import { KNOWN_BY_LEVEL } from '../../../../packages/sudoku-core/src/fixtures/known.js';
import { cellsFrom, makeHarness, type Harness } from './testHarness.js';

const EASY = KNOWN_BY_LEVEL.easy;

let h: Harness;
beforeEach(async () => {
  h = await makeHarness();
});
afterEach(async () => {
  await h.close();
});

const createGame = (level = 'easy') =>
  h.app.inject({ method: 'POST', url: '/api/game', payload: { level } });

describe('GET /api/game', () => {
  it('is 204 with no body when there is no active game', async () => {
    const res = await h.app.inject({ method: 'GET', url: '/api/game' });
    expect(res.statusCode).toBe(204);
    expect(res.body).toBe('');
  });
});

describe('POST /api/game', () => {
  it('creates a game whose cells are 81 long with the givens carrying their digit', async () => {
    const res = await createGame();
    expect(res.statusCode).toBe(201);
    const game = res.json<ActiveGame>();

    expect(game.level).toBe('easy');
    expect(game.givens).toBe(EASY.givens);
    expect(game.elapsedMs).toBe(0);
    expect(game.cells).toHaveLength(81);
    expect(game.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(new Date(game.startedAt).toISOString()).toBe(game.startedAt);

    for (let i = 0; i < 81; i += 1) {
      const cell = game.cells[i] as CellState;
      expect(cell.value).toBe(EASY.givens.charCodeAt(i) - 48);
      expect(cell.marks).toEqual([]);
    }
  });

  it('is 409 active-game-exists on the second create (decision 8)', async () => {
    expect((await createGame()).statusCode).toBe(201);
    const second = await createGame('medium');
    expect(second.statusCode).toBe(409);
    expect(second.json()).toEqual({ error: 'active-game-exists' });
  });

  it('is 400 for a level that is not one of the six', async () => {
    const res = await createGame('impossible');
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: 'bad-request' });
  });

  it('is 400 for a body that is not an object, and for malformed JSON', async () => {
    const notObject = await h.app.inject({ method: 'POST', url: '/api/game', payload: [1, 2] });
    expect(notObject.statusCode).toBe(400);
    expect(notObject.json()).toMatchObject({ error: 'bad-request' });

    const malformed = await h.app.inject({
      method: 'POST',
      url: '/api/game',
      headers: { 'content-type': 'application/json' },
      payload: '{"level":',
    });
    expect(malformed.statusCode).toBe(400);
    expect(malformed.json()).toMatchObject({ error: 'bad-request' });
  });
});

describe('PUT /api/game/progress', () => {
  it('round-trips pencil marks and elapsedMs', async () => {
    await createGame();
    const cells = cellsFrom(EASY.givens);
    (cells[2] as CellState).value = 4;
    (cells[3] as CellState).marks = [9, 1, 5];
    (cells[4] as CellState).marks = [7];

    const saved = await h.app.inject({
      method: 'PUT',
      url: '/api/game/progress',
      payload: { cells, elapsedMs: 4321 },
    });
    expect(saved.statusCode).toBe(200);
    expect(saved.json<ActiveGame>().elapsedMs).toBe(4321);

    const reloaded = (await h.app.inject({ method: 'GET', url: '/api/game' })).json<ActiveGame>();
    expect(reloaded.elapsedMs).toBe(4321);
    expect((reloaded.cells[2] as CellState).value).toBe(4);
    expect((reloaded.cells[3] as CellState).marks).toEqual([1, 5, 9]);
    expect((reloaded.cells[4] as CellState).marks).toEqual([7]);
  });

  it('is 404 when there is no active game', async () => {
    const res = await h.app.inject({
      method: 'PUT',
      url: '/api/game/progress',
      payload: { cells: cellsFrom(EASY.givens), elapsedMs: 0 },
    });
    expect(res.statusCode).toBe(404);
  });

  it('is 400 on a short board, a bad value, a bad mark or a negative elapsedMs', async () => {
    await createGame();
    const good = cellsFrom(EASY.givens);
    const put = (payload: unknown) =>
      h.app.inject({ method: 'PUT', url: '/api/game/progress', payload: payload as object });

    expect((await put({ cells: good.slice(0, 80), elapsedMs: 0 })).statusCode).toBe(400);
    expect((await put({ cells: good, elapsedMs: -1 })).statusCode).toBe(400);
    expect((await put({ cells: good, elapsedMs: 'soon' })).statusCode).toBe(400);

    const badValue = cellsFrom(EASY.givens);
    (badValue[0] as CellState).value = 10 as CellState['value'];
    expect((await put({ cells: badValue, elapsedMs: 0 })).statusCode).toBe(400);

    const badMark = cellsFrom(EASY.givens);
    (badMark[0] as CellState).marks = [0];
    const res = await put({ cells: badMark, elapsedMs: 0 });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: 'bad-request' });
  });
});

describe('POST /api/game/complete', () => {
  it('is 409 not-solved with the index of the one wrong cell', async () => {
    await createGame();
    const cells = cellsFrom(EASY.solution);
    const wrongAt = 40;
    const right = (cells[wrongAt] as CellState).value;
    (cells[wrongAt] as CellState).value = ((right % 9) + 1) as CellState['value'];
    await h.app.inject({
      method: 'PUT',
      url: '/api/game/progress',
      payload: { cells, elapsedMs: 1 },
    });

    const res = await h.app.inject({ method: 'POST', url: '/api/game/complete' });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: 'not-solved', wrongCells: [wrongAt] });

    // and the game is still active — a failed completion never ends it
    expect((await h.app.inject({ method: 'GET', url: '/api/game' })).statusCode).toBe(200);
  });

  it('moves a correct board into history and leaves no active game', async () => {
    await createGame();
    await h.app.inject({
      method: 'PUT',
      url: '/api/game/progress',
      payload: { cells: cellsFrom(EASY.solution), elapsedMs: 92_000 },
    });

    const res = await h.app.inject({ method: 'POST', url: '/api/game/complete' });
    expect(res.statusCode).toBe(200);
    const entry = res.json<HistoryEntry>();
    expect(entry.level).toBe('easy');
    expect(entry.givens).toBe(EASY.givens);
    expect(entry.elapsedMs).toBe(92_000);
    expect(new Date(entry.completedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(entry.startedAt).getTime(),
    );

    expect((await h.app.inject({ method: 'GET', url: '/api/game' })).statusCode).toBe(204);

    const history = (await h.app.inject({ method: 'GET', url: '/api/history' })).json<
      HistoryEntry[]
    >();
    expect(history).toHaveLength(1);
    expect(history[0]?.id).toBe(entry.id);
  });

  it('is 404 when there is no active game', async () => {
    const res = await h.app.inject({ method: 'POST', url: '/api/game/complete' });
    expect(res.statusCode).toBe(404);
  });
});

describe('GET /api/history', () => {
  it('is empty to start with and then newest completedAt first', async () => {
    expect(
      (await h.app.inject({ method: 'GET', url: '/api/history' })).json<HistoryEntry[]>(),
    ).toEqual([]);

    const completed: string[] = [];
    for (const level of ['easy', 'medium', 'tricky'] as const) {
      await createGame(level);
      await h.app.inject({
        method: 'PUT',
        url: '/api/game/progress',
        payload: { cells: cellsFrom(KNOWN_BY_LEVEL[level].solution), elapsedMs: 1000 },
      });
      const res = await h.app.inject({ method: 'POST', url: '/api/game/complete' });
      expect(res.statusCode).toBe(200);
      completed.push(res.json<HistoryEntry>().id);
    }

    const history = (await h.app.inject({ method: 'GET', url: '/api/history' })).json<
      HistoryEntry[]
    >();
    expect(history.map((entry) => entry.id)).toEqual([...completed].reverse());
    expect(history.map((entry) => entry.level)).toEqual(['tricky', 'medium', 'easy']);
  });
});

describe('unknown routes', () => {
  it('are 404 JSON, not an SPA fallback, when no client is built', async () => {
    const res = await h.app.inject({ method: 'GET', url: '/api/nope' });
    expect(res.statusCode).toBe(404);
  });
});

describe('SPA fallback', () => {
  it('is off entirely when no client is built', async () => {
    for (const url of ['/', '/history', '/assets/app.js']) {
      expect((await h.app.inject({ method: 'GET', url })).statusCode).toBe(404);
    }
  });
});
