/**
 * `useGame` against a mocked fetch.
 *
 * The fixture every test here loads is deliberately **not** a fresh board: it
 * is a puzzle one cell from complete, with pencil marks left behind in one box
 * and a timer past an hour. That is what the server hands back on a reload and
 * it is the case the plan names as the one to fear — a hook that only works
 * from an empty board fails the first describe block in this file.
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActiveGame, CellState, Digit } from '../shared/api';
import { SAVE_DEBOUNCE_MS, useGame } from './useGame';

// --- fetch double ---------------------------------------------------------

interface Call {
  url: string;
  method: string;
  body: { cells?: CellState[]; elapsedMs?: number; level?: string } | undefined;
  keepalive: boolean;
}

type Handler = (call: Call) => Promise<{ status: number; body?: unknown }>;

let calls: Call[] = [];

function installFetch(handler: Handler): void {
  calls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: unknown, init: RequestInit = {}) => {
      const call: Call = {
        url: String(input),
        method: (init.method ?? 'GET').toUpperCase(),
        body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
        keepalive: init.keepalive === true,
      };
      calls.push(call);
      const { status, body } = await handler(call);
      return { status, json: async () => body } as unknown as Response;
    }),
  );
}

const puts = () => calls.filter((c) => c.method === 'PUT');

// --- fixtures -------------------------------------------------------------

/** A valid complete grid, from the standard shifted-base pattern. */
function solvedDigits(): Digit[] {
  return Array.from({ length: 81 }, (_, i) => {
    const row = Math.floor(i / 9);
    const col = i % 9;
    return (((row * 3 + Math.floor(row / 3) + col) % 9) + 1) as Digit;
  });
}

const SOLVED = solvedDigits();
const HOUR_PLUS = 3_723_456;
/** the one cell still to play */
const EMPTY_INDEX = 40;
/** its correct digit, so a test can finish the board without a conflict */
const EMPTY_ANSWER = SOLVED[EMPTY_INDEX] as Digit;
/** a filled, non-given cell to edit without ever completing the board */
const EDIT_INDEX = 41;

function awkwardGame(): ActiveGame {
  const cells: CellState[] = SOLVED.map((value) => ({ value, marks: [] }));
  const setCell = (index: number, patch: Partial<CellState>) => {
    const cell = cells[index];
    if (cell) cells[index] = { value: patch.value ?? cell.value, marks: patch.marks ?? cell.marks };
  };
  setCell(EMPTY_INDEX, { value: 0, marks: [2, 5, 7] });
  setCell(EDIT_INDEX, { marks: [1, 9] });
  setCell(49, { marks: [4] });
  return {
    id: 'game-1',
    level: 'easy',
    // every third cell is a given, so the edit targets below are all free
    givens: SOLVED.map((d, i) => (i % 3 === 0 ? String(d) : '0')).join(''),
    cells,
    elapsedMs: HOUR_PLUS,
    startedAt: '2026-08-29T09:00:00.000Z',
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function mount(handler?: Handler) {
  const game = awkwardGame();
  installFetch(
    handler ??
      (async (call) => {
        if (call.method === 'GET' && call.url === '/api/game') return { status: 200, body: game };
        return { status: 200, body: game };
      }),
  );
  const hook = renderHook(() => useGame());
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  return { hook, game };
}

const settle = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

// --- the hunt -------------------------------------------------------------

describe('loading a half-finished puzzle', () => {
  it('adopts the cells, the marks and the elapsed time exactly as sent', async () => {
    const { hook, game } = await mount();

    expect(hook.result.current.status).toBe('playing');
    expect(hook.result.current.cells).toHaveLength(81);
    expect(hook.result.current.cells[EMPTY_INDEX]).toEqual({ value: 0, marks: [2, 5, 7] });
    // Marks behind an already-filled cell survive the round trip.
    expect(hook.result.current.cells[EDIT_INDEX]?.marks).toEqual([1, 9]);
    expect(hook.result.current.cells[49]?.marks).toEqual([4]);
    expect(hook.result.current.elapsedMs).toBe(HOUR_PLUS);
    expect(hook.result.current.givens).toBe(game.givens);
    expect(hook.result.current.isGiven(0)).toBe(true);
    expect(hook.result.current.isGiven(EDIT_INDEX)).toBe(false);
  });

  it('continues the timer from the loaded value instead of restarting it', async () => {
    const { hook } = await mount();

    await settle(3_000);

    expect(hook.result.current.elapsedMs).toBeGreaterThanOrEqual(HOUR_PLUS + 3_000);
  });

  it('does not treat the load itself as an edit worth saving', async () => {
    const { hook } = await mount();

    await settle(SAVE_DEBOUNCE_MS * 4);

    expect(puts()).toHaveLength(0);
    expect(hook.result.current.saveState).toBe('idle');
  });

  it('refuses to change a given', async () => {
    const { hook } = await mount();
    const before = hook.result.current.cells[0];

    act(() => {
      hook.result.current.setValue(0, 5);
      hook.result.current.toggleMark(0, 5);
      hook.result.current.clearCell(0);
    });
    await settle(SAVE_DEBOUNCE_MS * 2);

    expect(hook.result.current.cells[0]).toEqual(before);
    expect(puts()).toHaveLength(0);
  });
});

// --- saving ---------------------------------------------------------------

describe('saving', () => {
  it('collapses rapid edits into a single PUT', async () => {
    const { hook } = await mount();

    act(() => {
      hook.result.current.setValue(EDIT_INDEX, 1);
    });
    await settle(100);
    act(() => {
      hook.result.current.setValue(EDIT_INDEX, 2);
    });
    await settle(100);
    act(() => {
      hook.result.current.toggleMark(EDIT_INDEX, 8);
    });

    expect(puts()).toHaveLength(0);

    await settle(SAVE_DEBOUNCE_MS + 100);

    expect(puts()).toHaveLength(1);
    expect(puts()[0]?.body?.cells?.[EDIT_INDEX]).toEqual({ value: 2, marks: [1, 8, 9] });
    expect(puts()[0]?.keepalive).toBe(false);
    expect(hook.result.current.saveState).toBe('saved');
  });

  it('sends the loaded elapsed time along, not a fresh zero', async () => {
    const { hook } = await mount();

    act(() => {
      hook.result.current.setValue(EDIT_INDEX, 4);
    });
    await settle(SAVE_DEBOUNCE_MS + 100);

    expect(puts()[0]?.body?.elapsedMs).toBeGreaterThanOrEqual(HOUR_PLUS);
  });

  it('saves immediately, with keepalive, when the tab is hidden', async () => {
    const { hook } = await mount();

    act(() => {
      hook.result.current.setValue(EDIT_INDEX, 3);
    });
    await settle(100);
    expect(puts()).toHaveLength(0);

    const original = Object.getOwnPropertyDescriptor(Document.prototype, 'visibilityState');
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(puts()).toHaveLength(1);
    expect(puts()[0]?.keepalive).toBe(true);
    expect(puts()[0]?.body?.cells?.[EDIT_INDEX]?.value).toBe(3);

    if (original) Object.defineProperty(document, 'visibilityState', original);
  });

  it('keeps the input and retries with backoff when a save fails', async () => {
    const game = awkwardGame();
    let attempts = 0;
    installFetch(async (call) => {
      if (call.method === 'GET') return { status: 200, body: game };
      if (call.method === 'PUT') {
        attempts++;
        if (attempts <= 2) throw new TypeError('network down');
        return { status: 200, body: game };
      }
      return { status: 200, body: game };
    });
    const hook = renderHook(() => useGame());
    await settle(0);

    act(() => {
      hook.result.current.setValue(EDIT_INDEX, 6);
    });
    await settle(SAVE_DEBOUNCE_MS + 100);

    expect(attempts).toBe(1);
    expect(hook.result.current.saveState).toBe('failed');
    // The edit is still on the board: a failed save costs nothing.
    expect(hook.result.current.cells[EDIT_INDEX]?.value).toBe(6);

    // An edit made while the network is down must reach the server too.
    act(() => {
      hook.result.current.toggleMark(EDIT_INDEX, 4);
    });
    await settle(5_000);

    expect(attempts).toBeGreaterThanOrEqual(2);
    expect(hook.result.current.saveState).toBe('saved');
    expect(puts().at(-1)?.body?.cells?.[EDIT_INDEX]).toEqual({ value: 6, marks: [1, 4, 9] });
  });
});

// --- completion -----------------------------------------------------------

describe('completion', () => {
  it('flushes progress first, then marks wrongCells on a 409', async () => {
    const game = awkwardGame();
    const order: string[] = [];
    installFetch(async (call) => {
      if (call.method === 'GET' && call.url === '/api/game') return { status: 200, body: game };
      if (call.method === 'PUT') {
        order.push('PUT');
        return { status: 200, body: game };
      }
      if (call.url === '/api/game/complete') {
        order.push('COMPLETE');
        return { status: 409, body: { error: 'not-solved', wrongCells: [7, 40] } };
      }
      return { status: 200, body: game };
    });
    const hook = renderHook(() => useGame());
    await settle(0);

    act(() => {
      hook.result.current.setValue(EMPTY_INDEX, EMPTY_ANSWER);
    });
    await settle(SAVE_DEBOUNCE_MS + 100);

    expect(order).toEqual(['PUT', 'COMPLETE']);
    expect([...hook.result.current.wrongCells].sort((a, b) => a - b)).toEqual([7, 40]);
    expect(hook.result.current.status).toBe('playing');
    // Nothing was blocked or cleared — the board is as the user left it.
    expect(hook.result.current.cells[EMPTY_INDEX]?.value).toBe(EMPTY_ANSWER);
  });

  it('moves to the completed state on a 200 and reports the recorded time', async () => {
    const game = awkwardGame();
    installFetch(async (call) => {
      if (call.method === 'GET' && call.url === '/api/game') return { status: 200, body: game };
      if (call.method === 'PUT') return { status: 200, body: game };
      if (call.url === '/api/game/complete') {
        return {
          status: 200,
          body: {
            id: game.id,
            level: game.level,
            startedAt: game.startedAt,
            completedAt: '2026-08-29T10:05:00.000Z',
            elapsedMs: HOUR_PLUS,
            givens: game.givens,
          },
        };
      }
      return { status: 200, body: game };
    });
    const hook = renderHook(() => useGame());
    await settle(0);

    act(() => {
      hook.result.current.setValue(EMPTY_INDEX, EMPTY_ANSWER);
    });
    await settle(SAVE_DEBOUNCE_MS + 100);

    expect(hook.result.current.status).toBe('completed');
    expect(hook.result.current.completed?.elapsedMs).toBe(HOUR_PLUS);
  });

  it('does not ask the server while the board conflicts with itself', async () => {
    const seen: string[] = [];
    const game = awkwardGame();
    installFetch(async (call) => {
      seen.push(`${call.method} ${call.url}`);
      if (call.method === 'GET' && call.url === '/api/game') return { status: 200, body: game };
      return { status: 200, body: game };
    });
    const hook = renderHook(() => useGame());
    await settle(0);

    const rowStart = Math.floor(EMPTY_INDEX / 9) * 9;
    const duplicate = (hook.result.current.cells[rowStart]?.value ?? 1) as Digit;
    act(() => {
      hook.result.current.setValue(EMPTY_INDEX, duplicate);
    });
    await settle(SAVE_DEBOUNCE_MS + 100);

    expect(hook.result.current.conflicts.size).toBeGreaterThan(0);
    expect(seen.filter((s) => s.includes('/complete'))).toHaveLength(0);
    // …but the conflicting digit was still accepted and still saved.
    expect(hook.result.current.cells[EMPTY_INDEX]?.value).toBe(duplicate);
    expect(puts()).toHaveLength(1);
  });
});

// --- no game --------------------------------------------------------------

describe('with no active game', () => {
  it('reports no-game on 204 and starts one on demand', async () => {
    const game = awkwardGame();
    let created = false;
    installFetch(async (call) => {
      if (call.method === 'GET' && call.url === '/api/game') {
        return created ? { status: 200, body: game } : { status: 204 };
      }
      if (call.method === 'POST' && call.url === '/api/game') {
        created = true;
        return { status: 201, body: game };
      }
      return { status: 200, body: game };
    });
    const hook = renderHook(() => useGame());
    await settle(0);

    expect(hook.result.current.status).toBe('no-game');

    await act(async () => {
      await hook.result.current.startGame('easy');
    });

    expect(hook.result.current.status).toBe('playing');
    expect(hook.result.current.elapsedMs).toBe(HOUR_PLUS);
  });
});
