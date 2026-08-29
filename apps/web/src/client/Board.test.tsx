/**
 * Board keyboard handling, driven the way a person drives it.
 *
 * The board under test is always a *resumed* one — givens, entered digits,
 * pencil marks left behind on a filled cell, a wrong cell flagged by the server
 * — because a board that only behaves on a fresh grid is the failure this
 * package exists to avoid.
 */

import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { CellState, Digit } from '../shared/api';
import { Board } from './Board';

// Row 0: givens 5 and 3 at columns 0 and 1, the rest free.
// Cell 2 holds an entered 5 (conflicting with the given 5 in the same row and
// box); cell 3 is empty with marks; cell 4 is filled but still carries marks.
const GIVENS = `53${'0'.repeat(79)}`;

/**
 * Nine 9s, one to a row, column and box — a digit the player has finished.
 * Placed legally so the board is only as awkward as it means to be: the count
 * is real, not a conflicting pile of the same digit.
 */
const NINES = [5, 17, 20, 33, 36, 48, 61, 64, 76];

/** A 7 and a 5 that share no unit with the 7 at cell 4 or the 5s in row 0. */
const LONE_SEVEN = 60;
const LONE_FIVE = 70;

function initialCells(): CellState[] {
  const cells: CellState[] = Array.from({ length: 81 }, () => ({
    value: 0 as Digit,
    marks: [],
  }));
  cells[0] = { value: 5, marks: [] };
  cells[1] = { value: 3, marks: [] };
  cells[2] = { value: 5, marks: [] };
  cells[3] = { value: 0, marks: [1, 4, 9] };
  cells[4] = { value: 7, marks: [2, 6] };
  cells[LONE_SEVEN] = { value: 7, marks: [] };
  cells[LONE_FIVE] = { value: 5, marks: [] };
  for (const index of NINES) cells[index] = { value: 9, marks: [] };
  return cells;
}

interface Spies {
  setValue: ReturnType<typeof vi.fn>;
  toggleMark: ReturnType<typeof vi.fn>;
  clear: ReturnType<typeof vi.fn>;
}

function Harness({ spies, startInMarkMode = false }: { spies: Spies; startInMarkMode?: boolean }) {
  const [cells, setCells] = useState<CellState[]>(initialCells);
  const [selected, setSelected] = useState<number | null>(null);
  const [markMode, setMarkMode] = useState(startInMarkMode);

  const patch = (index: number, next: CellState) =>
    setCells((current) => current.map((cell, i) => (i === index ? next : cell)));

  return (
    <>
      <button type="button" onClick={() => setMarkMode((m) => !m)}>
        mark mode
      </button>
      <Board
        givens={GIVENS}
        cells={cells}
        selected={selected}
        onSelect={setSelected}
        conflicts={new Set([0, 2])}
        wrongCells={new Set([4])}
        markMode={markMode}
        onSetValue={(index, digit) => {
          spies.setValue(index, digit);
          const cell = cells[index];
          if (cell) patch(index, { value: digit, marks: cell.marks });
        }}
        onToggleMark={(index, digit) => {
          spies.toggleMark(index, digit);
          const cell = cells[index];
          if (!cell) return;
          patch(index, {
            value: cell.value,
            marks: cell.marks.includes(digit)
              ? cell.marks.filter((d) => d !== digit)
              : [...cell.marks, digit].sort((a, b) => a - b),
          });
        }}
        onClear={(index) => {
          spies.clear(index);
          patch(index, { value: 0, marks: [] });
        }}
      />
    </>
  );
}

function setup(startInMarkMode = false) {
  const spies: Spies = { setValue: vi.fn(), toggleMark: vi.fn(), clear: vi.fn() };
  const user = userEvent.setup();
  render(<Harness spies={spies} startInMarkMode={startInMarkMode} />);
  return { spies, user };
}

const attr = (index: number, name: string): string | null =>
  screen.getByTestId(`cell-${index}`).getAttribute(name);

const classesOf = (index: number): string => screen.getByTestId(`cell-${index}`).className;

const selectedCells = (): number[] =>
  Array.from(document.querySelectorAll('[aria-selected="true"]'), (el) =>
    Number(el.getAttribute('data-index')),
  ).sort((a, b) => a - b);

const sameDigitCells = (): number[] =>
  Array.from(document.querySelectorAll('.cell-same'), (el) =>
    Number(el.getAttribute('data-index')),
  ).sort((a, b) => a - b);

const marksOf = (index: number): string[] =>
  Array.from(
    screen.getByTestId(`cell-${index}`).querySelectorAll('.mark-on'),
    (el) => el.textContent ?? '',
  );

describe('a resumed board', () => {
  it('renders givens, entered digits and leftover marks as it received them', () => {
    setup();

    expect(attr(0, 'aria-readonly')).toBe('true');
    expect(attr(2, 'aria-readonly')).toBe('false');
    expect(screen.getByTestId('cell-0').textContent).toBe('5');
    expect(marksOf(3)).toEqual(['1', '4', '9']);
    // A filled cell hides its marks but has not lost them.
    expect(screen.getByTestId('cell-4').textContent).toBe('7');
  });

  it('highlights conflicts and server-reported wrong cells without blocking them', async () => {
    const { spies, user } = setup();

    expect(screen.getByTestId('cell-0').className).toContain('cell-conflict');
    expect(screen.getByTestId('cell-2').className).toContain('cell-conflict');
    expect(screen.getByTestId('cell-4').className).toContain('cell-wrong');

    // The conflicting cell still accepts another conflicting digit.
    await user.click(screen.getByTestId('cell-2'));
    await user.keyboard('3');
    expect(spies.setValue).toHaveBeenCalledWith(2, 3);
  });
});

describe('keyboard', () => {
  it('moves the selection with the arrow keys and stops at the edges', async () => {
    const { user } = setup();

    await user.click(screen.getByTestId('cell-10'));
    expect(attr(10, 'aria-selected')).toBe('true');

    await user.keyboard('{ArrowRight}{ArrowDown}');
    expect(attr(20, 'aria-selected')).toBe('true');

    await user.keyboard('{ArrowUp}{ArrowUp}{ArrowUp}');
    expect(attr(2, 'aria-selected')).toBe('true');
  });

  it('leaves a given alone whatever is typed at it', async () => {
    const { spies, user } = setup();

    await user.click(screen.getByTestId('cell-0'));
    await user.keyboard('9');
    await user.keyboard('{Shift>}9{/Shift}');
    await user.keyboard('{Backspace}');
    await user.keyboard('0');

    expect(spies.setValue).not.toHaveBeenCalled();
    expect(spies.toggleMark).not.toHaveBeenCalled();
    expect(spies.clear).not.toHaveBeenCalled();
    expect(screen.getByTestId('cell-0').textContent).toBe('5');
    // Nothing was entered, so there is nothing to deselect for.
    expect(attr(0, 'aria-selected')).toBe('true');
  });

  it('enters a digit with 1-9 and clears with 0, Backspace and Delete', async () => {
    const { spies, user } = setup();

    await user.click(screen.getByTestId('cell-3'));
    await user.keyboard('6');
    expect(spies.setValue).toHaveBeenCalledWith(3, 6);
    expect(screen.getByTestId('cell-3').textContent).toBe('6');

    // A digit drops the selection (see `selection after an edit` below), so
    // every entry from here on re-selects the cell first. Clearing does not.
    await user.click(screen.getByTestId('cell-3'));
    await user.keyboard('{Backspace}');
    expect(spies.clear).toHaveBeenLastCalledWith(3);

    await user.keyboard('4');
    await user.click(screen.getByTestId('cell-3'));
    await user.keyboard('{Delete}');
    expect(spies.clear).toHaveBeenCalledTimes(2);

    await user.keyboard('4');
    await user.click(screen.getByTestId('cell-3'));
    await user.keyboard('0');
    expect(spies.clear).toHaveBeenCalledTimes(3);
  });

  it('toggles a pencil mark with Shift+digit, on and off again', async () => {
    const { spies, user } = setup();

    await user.click(screen.getByTestId('cell-3'));
    expect(marksOf(3)).toEqual(['1', '4', '9']);

    await user.keyboard('{Shift>}7{/Shift}');
    expect(spies.toggleMark).toHaveBeenCalledWith(3, 7);
    expect(marksOf(3)).toEqual(['1', '4', '7', '9']);
    expect(spies.setValue).not.toHaveBeenCalled();

    await user.keyboard('{Shift>}7{/Shift}');
    expect(marksOf(3)).toEqual(['1', '4', '9']);

    // The marks it arrived with are untouched by all of that.
    await user.keyboard('{Shift>}1{/Shift}');
    expect(marksOf(3)).toEqual(['4', '9']);
  });

  it('mark mode swaps the two meanings, and Shift swaps them back', async () => {
    const { spies, user } = setup(true);

    await user.click(screen.getByTestId('cell-3'));
    await user.keyboard('7');
    expect(spies.toggleMark).toHaveBeenCalledWith(3, 7);
    expect(spies.setValue).not.toHaveBeenCalled();

    await user.keyboard('{Shift>}8{/Shift}');
    expect(spies.setValue).toHaveBeenCalledWith(3, 8);
  });
});

describe('same-digit highlighting', () => {
  it('tints every other cell holding the selected digit, but not the selection itself', async () => {
    const { user } = setup();

    await user.click(screen.getByTestId(`cell-${LONE_SEVEN}`));

    // Cell 4 holds the other 7. The selected cell keeps its own highlight and
    // never doubles as a same-number one.
    expect(sameDigitCells()).toEqual([4]);
    expect(classesOf(LONE_SEVEN)).toContain('cell-selected');
    expect(classesOf(LONE_SEVEN)).not.toContain('cell-same');
    expect(attr(LONE_SEVEN, 'aria-selected')).toBe('true');
    expect(attr(4, 'aria-selected')).toBe('false');
  });

  it('works from a given, and a conflict outranks the same-number tint', async () => {
    const { user } = setup();

    await user.click(screen.getByTestId('cell-0'));

    // Cells 2 and 70 are the other 5s; 2 is a conflict, so it keeps the
    // conflict backdrop rather than the softer same-number one.
    expect(sameDigitCells()).toEqual([LONE_FIVE]);
    expect(classesOf(2)).toContain('cell-conflict');
    expect(classesOf(2)).not.toContain('cell-same');
    expect(classesOf(1)).not.toContain('cell-same');
  });

  it('highlights nothing extra when the selected cell is empty', async () => {
    const { user } = setup();

    await user.click(screen.getByTestId('cell-3'));
    expect(sameDigitCells()).toEqual([]);
  });

  it('follows the keyboard: arrowing onto a digit lights the same ones a click would', async () => {
    const { user } = setup();

    await user.click(screen.getByTestId('cell-51'));
    expect(sameDigitCells()).toEqual([]);

    // 51 -> 60 is one row down, onto the lone 7.
    await user.keyboard('{ArrowDown}');
    expect(attr(LONE_SEVEN, 'aria-selected')).toBe('true');
    expect(sameDigitCells()).toEqual([4]);
  });
});

describe('selection after an edit', () => {
  it('drops the selection once a digit lands', async () => {
    const { spies, user } = setup();

    await user.click(screen.getByTestId('cell-3'));
    await user.keyboard('6');

    expect(spies.setValue).toHaveBeenCalledWith(3, 6);
    expect(selectedCells()).toEqual([]);
    expect(attr(3, 'aria-selected')).toBe('false');
  });

  it('keeps the selection through a clear, a pencil mark and an arrow key', async () => {
    const { spies, user } = setup();

    await user.click(screen.getByTestId('cell-3'));

    await user.keyboard('{Backspace}');
    expect(spies.clear).toHaveBeenLastCalledWith(3);
    expect(selectedCells()).toEqual([3]);

    await user.keyboard('0');
    expect(selectedCells()).toEqual([3]);

    await user.keyboard('{Shift>}7{/Shift}');
    expect(spies.toggleMark).toHaveBeenCalledWith(3, 7);
    expect(selectedCells()).toEqual([3]);

    await user.keyboard('{ArrowRight}');
    expect(selectedCells()).toEqual([4]);
  });

  it('keeps the selection when mark mode turns a bare digit into a mark', async () => {
    const { spies, user } = setup(true);

    await user.click(screen.getByTestId('cell-3'));
    await user.keyboard('7');

    expect(spies.toggleMark).toHaveBeenCalledWith(3, 7);
    expect(spies.setValue).not.toHaveBeenCalled();
    expect(selectedCells()).toEqual([3]);
  });

  it('leaves the arrow keys working: the first one after an entry lands on cell 0', async () => {
    const { user } = setup();

    await user.click(screen.getByTestId('cell-3'));
    await user.keyboard('6');
    expect(selectedCells()).toEqual([]);

    // Unchanged behaviour, newly reachable: an arrow with nothing selected
    // selects the top-left cell rather than doing nothing.
    await user.keyboard('{ArrowDown}');
    expect(selectedCells()).toEqual([0]);
  });
});
