/**
 * The fixture shape the plan says every other test avoids: a board **one cell
 * from complete, with a wrong digit and six pencil marks in the same box**, met
 * for the first time on a page load, with the timer already past an hour.
 *
 * `SUDOKU_FIXTURE=awkward` seeds exactly that row before the server listens
 * (`server/awkward.ts` — this spec does not rebuild the state, it reads what
 * that seeding actually wrote), so the browser's first sight of the app is a
 * half-finished game. That is the assumption the plan names — *"the board is
 * empty when the app loads"* — and this is where it gets falsified.
 *
 * The shape is asserted, not compared: "exactly one empty cell, exactly one
 * entered digit that disagrees with the solution in that cell's box, six marks
 * drawn in the hole, elapsed past an hour". Comparing the row against
 * `buildAwkwardState()` would only prove that function is a function; this
 * fails if the fixture ever stops being awkward.
 *
 * The second half is the other named regression: **an edit followed within the
 * 500 ms debounce by the page going away must still be saved.** The proof is
 * not "the value came back"; on its own that is also what a fired debounce
 * looks like. It is "no PUT had been issued when the navigation started, *and*
 * the value came back" — which can only be the `pagehide` + `keepalive` save.
 */

import { expect, test } from '@playwright/test';
import type { CellState } from '../src/shared/api';
import { cellLabel, shoot } from './board';
import { activeRow, completedRows, type GameRow } from './db';
import { AWKWARD } from './servers';

/**
 * Mirrors `SAVE_DEBOUNCE_MS` in `src/client/useGame.ts`. Not imported: that
 * module pulls React in, and this file runs under Node.
 */
const SAVE_DEBOUNCE_MS = 500;

/** Past an hour — the plan's timer condition, checked as a duration not a string. */
const ONE_HOUR_MS = 3_600_000;

const boxOf = (index: number): number => Math.floor(index / 27) * 3 + Math.floor((index % 9) / 3);

interface Seeded {
  row: GameRow;
  cells: CellState[];
  emptyCell: number;
  wrongCell: number;
  markedCells: number[];
  markCount: number;
}

function readSeeded(): Seeded {
  const row = activeRow(AWKWARD);
  expect(row, 'SUDOKU_FIXTURE=awkward must seed an active game at boot').not.toBeNull();
  const game = row as GameRow;
  const cells = JSON.parse(game.cells_json) as CellState[];

  const empties = cells.flatMap((cell, i) => (cell.value === 0 ? [i] : []));
  const wrong = cells.flatMap((cell, i) =>
    cell.value !== 0 && cell.value !== Number(game.solution[i]) ? [i] : [],
  );
  const marked = cells.flatMap((cell, i) => (cell.marks.length > 0 ? [i] : []));

  expect(empties, 'one cell from complete').toHaveLength(1);
  expect(wrong, 'exactly one wrong digit').toHaveLength(1);

  return {
    row: game,
    cells,
    emptyCell: empties[0] as number,
    wrongCell: wrong[0] as number,
    markedCells: marked,
    markCount: cells.reduce((n, cell) => n + cell.marks.length, 0),
  };
}

test('the awkward board loads as it was left, and an edit outruns the debounce', async ({
  page,
}, testInfo) => {
  const seeded = readSeeded();

  const puts: number[] = [];
  page.on('request', (req) => {
    if (req.method() === 'PUT') puts.push(Date.now());
  });

  await test.step('the app opens straight onto a half-finished puzzle', async () => {
    await page.goto('/');
    await expect(page.getByTestId('board')).toBeVisible();
    // Not the picker. A resumed game is not a new one.
    await expect(page.getByRole('region', { name: 'choose a level' })).toHaveCount(0);
    await shoot(page, 'awkward-onload');
  });

  await test.step('one cell from complete, with one wrong digit', async () => {
    await expect(page.locator('[data-testid=board] .cell-value')).toHaveCount(80);
    // The hole holds no digit — it shows its pencil marks instead, so assert
    // the absence of a value rather than the absence of text.
    await expect(page.getByTestId(`cell-${seeded.emptyCell}`).locator('.cell-value')).toHaveCount(
      0,
    );

    const wrongDigit = seeded.cells[seeded.wrongCell]?.value ?? 0;
    await expect(page.getByTestId(`cell-${seeded.wrongCell}`)).toHaveText(String(wrongDigit));
    // Entered, not given: the player must be able to correct it.
    expect(await cellLabel(page, seeded.wrongCell)).toContain(`entered ${wrongDigit}`);
    expect(seeded.row.givens[seeded.wrongCell]).toBe('0');
  });

  await test.step('six pencil marks, drawn in the hole', async () => {
    expect(seeded.markCount).toBe(6);
    // All six on the one empty cell. `Cell.tsx` hides marks behind a digit on
    // purpose, so marks on a filled cell would be stored and never seen — the
    // fixture would be awkward in the database and tidy on screen. Assert the
    // *rendered* marks: this is the load the fixture exists to show.
    expect(seeded.markedCells).toEqual([seeded.emptyCell]);
    expect(boxOf(seeded.wrongCell)).toBe(boxOf(seeded.emptyCell));

    const hole = page.getByTestId(`cell-${seeded.emptyCell}`);
    await expect(hole.locator('.cell-marks')).toBeVisible();
    await expect(hole.locator('.mark-on')).toHaveCount(6);
    await expect(hole.locator('.mark-on')).toHaveText(
      (seeded.cells[seeded.emptyCell]?.marks ?? []).map(String),
    );
    // Nowhere else on the board is drawing marks.
    await expect(page.locator('[data-testid=board] .cell-marks')).toHaveCount(1);

    testInfo.annotations.push({
      type: 'awkward marks',
      description: `${seeded.markCount} marks rendered in cell ${seeded.emptyCell}`,
    });
  });

  await test.step('the timer resumed past an hour', async () => {
    expect(seeded.row.elapsed_ms).toBeGreaterThan(ONE_HOUR_MS);
    // `h:mm:ss`, never a bare `62:05` — the hour field appears once it is real.
    await expect(page.getByTestId('timer')).toHaveText(/^\d+:[0-5]\d:[0-5]\d$/);
  });

  await test.step('an edit and an immediate navigation: the save still lands', async () => {
    const rightDigit = Number(seeded.row.solution[seeded.wrongCell]);
    const before = puts.length;
    const editedAt = Date.now();

    await page.getByTestId(`cell-${seeded.wrongCell}`).click();
    await page.keyboard.press(String(rightDigit));

    // The window this test exists for. If the machine were slow enough that the
    // debounce had already fired, `puts` would have grown and the reload below
    // would be proving nothing — so fail here instead, loudly.
    const gap = Date.now() - editedAt;
    testInfo.annotations.push({ type: 'edit-to-navigation', description: `${gap} ms` });
    expect(puts.length, 'the debounced save must not have fired yet').toBe(before);
    expect(
      gap,
      `edit-to-navigation ${gap} ms must be inside the ${SAVE_DEBOUNCE_MS} ms debounce`,
    ).toBeLessThan(SAVE_DEBOUNCE_MS);

    await page.reload();
    await expect(page.getByTestId('board')).toBeVisible();
    await expect(page.getByTestId(`cell-${seeded.wrongCell}`)).toHaveText(String(rightDigit));

    const persisted = JSON.parse((activeRow(AWKWARD) as GameRow).cells_json) as CellState[];
    expect(persisted[seeded.wrongCell]?.value).toBe(rightDigit);
  });

  await test.step('filling the last hole completes it, carrying the hour with it', async () => {
    const digit = Number(seeded.row.solution[seeded.emptyCell]);
    await page.getByTestId(`cell-${seeded.emptyCell}`).click();
    await page.keyboard.press(String(digit));

    await expect(page.getByTestId('completion')).toBeVisible();
    await shoot(page, 'awkward-completed');

    const rows = completedRows(AWKWARD);
    expect(rows).toHaveLength(1);
    // The elapsed time came from the seeded row, not from this test's few
    // seconds: a resumed game keeps the time it was already worth.
    expect(rows[0]?.elapsed_ms ?? 0).toBeGreaterThanOrEqual(seeded.row.elapsed_ms);
    expect(activeRow(AWKWARD)).toBeNull();
  });
});
