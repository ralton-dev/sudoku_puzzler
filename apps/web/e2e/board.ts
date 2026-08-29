/**
 * Driving the real board with the real keyboard.
 *
 * Everything here goes through the UI the way a person does — click the cell,
 * press the digit — rather than through `page.evaluate` into React state. A
 * helper that set state directly would prove nothing about the thing the plan
 * cares about, which is that an edit reaches SQLite.
 */

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page } from '@playwright/test';

/**
 * Where the narrative screenshots land.
 *
 * Resolved from this module's own location, not from `process.cwd()`, so it is
 * the same directory whether the run came from the repo root or from
 * `apps/web`. `E2E_SHOTS_DIR` overrides it — that is how a human parks them
 * somewhere they can look at them without them turning up in `git status`.
 *
 * The default sits under `apps/web/test-results/`, which `.gitignore` already
 * covers. It was previously an absolute path on one machine, which passed
 * locally and failed CI with EACCES: a screenshot is evidence, so it must never
 * be the reason a run goes red — see `shoot` below.
 */
export const SCREENSHOT_DIR =
  process.env.E2E_SHOTS_DIR && process.env.E2E_SHOTS_DIR.length > 0
    ? process.env.E2E_SHOTS_DIR
    : join(fileURLToPath(new URL('.', import.meta.url)), '..', 'test-results', 'shots');

/**
 * Take a screenshot, and never fail the test for it. A missing image loses a
 * paragraph of the report; a throw here would lose the assertion that was
 * about to run.
 */
export async function shoot(page: Page, name: string): Promise<void> {
  try {
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
    await page.screenshot({ path: join(SCREENSHOT_DIR, `${name}.png`), fullPage: true });
  } catch (error) {
    console.warn(`could not write the ${name} screenshot: ${String(error)}`);
  }
}

/** Indices the puzzle left empty — the only ones a player may type into. */
export const openCells = (givens: string): number[] =>
  [...givens].flatMap((ch, index) => (ch === '0' ? [index] : []));

/** Select one square. `Cell` listens on pointerdown and focuses the grid itself. */
export async function selectCell(page: Page, index: number): Promise<void> {
  await page.getByTestId(`cell-${index}`).click();
}

/** Type one digit into one square. */
export async function enterDigit(page: Page, index: number, digit: number): Promise<void> {
  await selectCell(page, index);
  await page.keyboard.press(String(digit));
}

/** Toggle one pencil mark (Shift inverts mark mode — see `Board.tsx`). */
export async function toggleMark(page: Page, index: number, digit: number): Promise<void> {
  await selectCell(page, index);
  await page.keyboard.press(`Shift+Digit${digit}`);
}

/** What the cell is showing, read from its aria-label rather than its markup. */
export async function cellLabel(page: Page, index: number): Promise<string> {
  return (await page.getByTestId(`cell-${index}`).getAttribute('aria-label')) ?? '';
}

/**
 * Fill every open square from the stored solution.
 *
 * Correct digits only, so the board never holds a conflict and the client's
 * "full and valid" completion check fires exactly once, at the last cell.
 */
export async function fillFromSolution(
  page: Page,
  givens: string,
  solution: string,
  options: { skip?: readonly number[] } = {},
): Promise<number> {
  const skip = new Set(options.skip ?? []);
  const targets = openCells(givens).filter((index) => !skip.has(index));
  for (const index of targets) {
    await enterDigit(page, index, Number(solution[index]));
  }
  return targets.length;
}

/** Every square shows something — the precondition for the completion attempt. */
export async function expectBoardFull(page: Page): Promise<void> {
  await expect(page.locator('[data-testid=board] .cell-value')).toHaveCount(81);
}
