/**
 * Driving the real board with the real keyboard.
 *
 * Everything here goes through the UI the way a person does — click the cell,
 * press the digit — rather than through `page.evaluate` into React state. A
 * helper that set state directly would prove nothing about the thing the plan
 * cares about, which is that an edit reaches SQLite.
 */

import { expect, type Page } from '@playwright/test';

export const SCREENSHOT_DIR =
  '/private/tmp/claude-501/-Users-benralton-repos-BEN-WORKING-sudoku-puzzler/20ae6ee1-9de4-4e01-907e-c86f28df3aa8/scratchpad/wp-g';

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
