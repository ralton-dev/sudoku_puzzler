/**
 * The whole app, in production shape: real `generate()`, real SQLite, real
 * browser, no fixture hook anywhere.
 *
 * This is the first place the real generator meets the real server, so the
 * first assertion is decision 5 — `countSolutions(givens, 2) === 1` — computed
 * by calling the core library from the test against the givens **the database
 * holds**. If the generator ever served a puzzle with two solutions, the
 * completion check would compare a correct alternative fill against the stored
 * solution and tell the player they were wrong. Nothing else in the stack would
 * notice.
 *
 * It is one test rather than five because it is one story with one database
 * behind it: decision 8 allows a single active game, so the steps could not be
 * independent even if they were written that way. `test.step` gives the
 * per-stage reporting that separate tests would have.
 */

import { expect, test } from '@playwright/test';
// Deep relative imports rather than the `sudoku-core` barrel, and the reason is
// worth writing down: Playwright transpiles each file and lets Node load it, so
// the barrel's transitive `import examples from './training/examples.json'`
// (WP-T1) fails under plain Node ESM, which requires `with { type: 'json' }`.
// The server never notices because esbuild bundles the JSON in. Nothing here
// needs the barrel, so it takes the two modules it actually uses.
import { parseGrid } from '../../../packages/sudoku-core/src/grid';
import { countSolutions } from '../../../packages/sudoku-core/src/solver';
import { fillFromSolution, openCells, shoot } from './board';
import type { CellState } from '../src/shared/api';
import { activeRow, completedRows } from './db';
import { PRODUCTION } from './servers';

test('a generated medium puzzle survives a reload and completes into history', async ({
  page,
  request,
}, testInfo) => {
  await test.step('a fresh database has no active game', async () => {
    expect(activeRow(PRODUCTION)).toBeNull();
    const res = await request.get('/api/game');
    expect(res.status()).toBe(204);
  });

  await page.goto('/');
  await expect(page.getByRole('region', { name: 'choose a level' })).toBeVisible();

  const startedAt = Date.now();
  await test.step('pick medium', async () => {
    await page.getByRole('button', { name: /^medium/ }).click();
    await expect(page.getByTestId('board')).toBeVisible();
  });
  const generationMs = Date.now() - startedAt;
  testInfo.annotations.push({
    type: 'medium generation (round trip)',
    description: `${generationMs} ms`,
  });

  const row = activeRow(PRODUCTION);
  expect(row, 'the game the browser is showing is a row in SQLite').not.toBeNull();
  const game = row as NonNullable<typeof row>;
  expect(game.level).toBe('medium');

  await test.step('decision 5: the served givens have exactly one solution', () => {
    // Core, called directly. Not an API round trip — the point is to check the
    // stored puzzle against the library's own definition of unique.
    expect(countSolutions(parseGrid(game.givens), 2)).toBe(1);
  });

  const open = openCells(game.givens);
  expect(open.length).toBeGreaterThan(20);

  // The timer must have credited real time before the puzzle is finished,
  // otherwise the history assertion below (`elapsedMs > 0`) would be vacuous.
  await expect(page.getByTestId('timer')).not.toHaveText('00:00');

  const probes = open.slice(0, 3);
  await test.step('enter three digits and let them save', async () => {
    for (const index of probes) {
      await page.getByTestId(`cell-${index}`).click();
      await page.keyboard.press(String(Number(game.solution[index])));
    }
    await expect(page.getByTestId('save-indicator')).toHaveAttribute('data-state', 'saved');
    await shoot(page, 'production-midgame');
  });

  await test.step('reload: the board comes back exactly as it was left', async () => {
    await page.reload();
    await expect(page.getByTestId('board')).toBeVisible();
    for (const index of probes) {
      await expect(page.getByTestId(`cell-${index}`)).toHaveText(
        String(Number(game.solution[index])),
      );
    }
    // Never the level picker: a reload mid-puzzle must not look like a fresh app.
    await expect(page.getByRole('region', { name: 'choose a level' })).toHaveCount(0);
  });

  await test.step('fill the rest from the solution stored in SQLite', async () => {
    const typed = await fillFromSolution(page, game.givens, game.solution, { skip: probes });
    expect(typed).toBe(open.length - probes.length);
  });

  await test.step('the server verifies completion (decision 10)', async () => {
    // Nothing here looks at the board, and that is the point. The client
    // attempts completion the instant the last cell makes the grid full and
    // valid, and on success it unmounts the board for the "Solved" panel — so
    // "all 81 cells are filled" is a state that exists for a few milliseconds
    // and is *never* safe to assert against the DOM. Doing so passed on every
    // local run and failed CI run 33258604286 twice, with the page already
    // showing "Solved — medium in 00:02".
    //
    // The durable form of the same claim is the row the server wrote. Decision
    // 10 means it only writes one when the saved cells match the stored
    // solution, so reading those cells back is a stronger statement than
    // counting digits on screen ever was: not just full, but right.
    await expect(page.getByTestId('completion')).toBeVisible();
    await expect(page.getByTestId('completion')).toContainText('medium');
    await shoot(page, 'production-completed');

    const finished = completedRows(PRODUCTION)[0];
    expect(finished?.id).toBe(game.id);
    const saved = JSON.parse(finished?.cells_json ?? '[]') as CellState[];
    expect(saved.map((cell) => cell.value).join('')).toBe(game.solution);
  });

  await test.step('history has one row, with a non-zero elapsed time', async () => {
    const rows = completedRows(PRODUCTION);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.elapsed_ms ?? 0).toBeGreaterThan(0);

    const res = await request.get('/api/history');
    expect(res.status()).toBe(200);
    const entries = (await res.json()) as Array<{ level: string; elapsedMs: number }>;
    expect(entries).toHaveLength(1);
    expect(entries[0]?.level).toBe('medium');
    expect(entries[0]?.elapsedMs).toBeGreaterThan(0);

    await page.getByRole('link', { name: 'History' }).click();
    await expect(page.getByTestId('history-table').locator('tbody tr')).toHaveCount(1);
  });

  await test.step('the completed game is gone, and a diabolical one can start', async () => {
    expect(activeRow(PRODUCTION)).toBeNull();
    const none = await request.get('/api/game');
    expect(none.status()).toBe(204);

    const created = await request.post('/api/game', { data: { level: 'diabolical' } });
    expect(created.status()).toBe(201);
    const body = (await created.json()) as { level: string; givens: string };
    expect(body.level).toBe('diabolical');
    // Decision 5 again, on the hardest band — the one the generator works
    // hardest for and is likeliest to get wrong.
    expect(countSolutions(parseGrid(body.givens), 2)).toBe(1);
  });
});
