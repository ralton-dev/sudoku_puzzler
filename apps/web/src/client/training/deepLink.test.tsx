/**
 * The hunt: the app loaded **directly on `/training/xWing`** while a
 * half-finished game is active.
 *
 * The plan's assumption to hunt for is "the board is empty when the app loads".
 * The training section's version of it is subtler and worse: a training page is
 * not the board, so it is easy to write one that is only ever reached *from*
 * the board — and then a bookmarked deep link arrives with no game loaded, or
 * worse, the training page quietly resets or re-saves the game it found.
 *
 * Three things are asserted here, and the third is the one the structure has to
 * guarantee rather than merely happen to satisfy:
 *
 *  1. the training page renders on a cold load of the deep link, with the game
 *     board nowhere on screen;
 *  2. the game still loads and still *ticks* underneath it — `useGame()` is
 *     called in `App` above the router outlet on purpose, so walking to
 *     training does not unmount the board, stop the timer or abandon a
 *     debounced save;
 *  3. nothing the learner does on the training page writes to the API. The
 *     training section is read-only (decision 18): it imports committed JSON
 *     from the workspace and holds no reference to the game hook at all, so
 *     there is no code path from a practise click to a `PUT`. The test drives
 *     the whole practise flow to completion and asserts the request log.
 */

import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { examplesFor, type TrainingExample } from 'sudoku-core';
import type { ActiveGame, CellState, Digit } from '../../shared/api';
import { App } from '../App';

interface Call {
  url: string;
  method: string;
}

let calls: Call[] = [];

/** The awkward fixture's shape: one cell short, marks left behind, past an hour. */
const HOUR_PLUS = 3_723_456;

function awkwardGame(): ActiveGame {
  const digits = Array.from(
    { length: 81 },
    (_, i) =>
      (((Math.floor(i / 9) * 3 + Math.floor(Math.floor(i / 9) / 3) + (i % 9)) % 9) + 1) as Digit,
  );
  const cells: CellState[] = digits.map((value) => ({ value, marks: [] }));
  cells[40] = { value: 0, marks: [2, 5, 7] };
  cells[41] = { value: digits[41] as Digit, marks: [1, 9] };
  return {
    id: 'game-1',
    level: 'tricky',
    givens: digits.map((d, i) => (i % 3 === 0 ? String(d) : '0')).join(''),
    cells,
    elapsedMs: HOUR_PLUS,
    startedAt: '2026-08-29T09:00:00.000Z',
  };
}

beforeEach(() => {
  calls = [];
  window.localStorage.clear();
  vi.useFakeTimers();
  const game = awkwardGame();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: unknown, init: RequestInit = {}) => {
      calls.push({ url: String(input), method: (init.method ?? 'GET').toUpperCase() });
      return { status: 200, json: async () => game } as unknown as Response;
    }),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

async function mountAt(path: string) {
  const view = render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  return view;
}

const gameGets = () => calls.filter((c) => c.method === 'GET' && c.url === '/api/game');
const writes = () => calls.filter((c) => c.method !== 'GET');

describe('a cold load straight onto /training/xWing', () => {
  it('renders the technique page and no board at all', async () => {
    await mountAt('/training/xWing');

    expect(screen.getByRole('heading', { name: /X-Wing/ })).toBeDefined();
    expect(screen.queryByTestId('board')).toBeNull();
  });

  it('still loads the active game underneath, and keeps its timer running', async () => {
    await mountAt('/training/xWing');

    // The hook lives above the outlet, so the game is loaded even though the
    // board is not on screen.
    expect(gameGets()).toHaveLength(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });

    // Walk to the board the way a person would.
    await act(async () => {
      screen.getByRole('link', { name: 'Play' }).click();
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByTestId('board')).toBeDefined();
    // Three seconds of training time are on the clock: the hook was never
    // unmounted, so the timer never restarted from the saved value.
    expect(screen.getByTestId('timer').textContent).toBe('1:02:06');
    // And it was never re-fetched either.
    expect(gameGets()).toHaveLength(1);
  });

  it('never writes to the API, however far the practise flow is driven', async () => {
    await mountAt('/training/xWing');

    const example = examplesFor('xWing')[1] as TrainingExample;

    await act(async () => {
      screen.getByRole('tab', { name: 'Practise' }).click();
    });
    await act(async () => {
      for (const cell of example.step.cells) {
        screen.getByTestId(`cb-cell-${cell}`).click();
      }
    });
    await act(async () => {
      screen.getByRole('button', { name: 'Check' }).click();
    });
    await act(async () => {
      for (const { cell, digits } of example.step.eliminations) {
        for (const digit of digits) screen.getByTestId(`cb-mark-${cell}-${digit}`).click();
      }
      for (const { cell, digit } of example.step.placements) {
        screen.getByTestId(`cb-mark-${cell}-${digit}`).click();
      }
    });
    await act(async () => {
      screen.getByRole('button', { name: 'Check' }).click();
    });

    expect(screen.getByTestId('practise-feedback').textContent).toBe('Correct.');
    // Solved, ticked, and the server heard nothing about any of it.
    expect(writes()).toEqual([]);

    // Not even after the save debounce and a visibility change would have
    // fired, had anything marked the game dirty.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(writes()).toEqual([]);
    expect(gameGets()).toHaveLength(1);
  });
});
