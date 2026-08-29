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
  });

  it('enters a digit with 1-9 and clears with 0, Backspace and Delete', async () => {
    const { spies, user } = setup();

    await user.click(screen.getByTestId('cell-3'));
    await user.keyboard('6');
    expect(spies.setValue).toHaveBeenCalledWith(3, 6);
    expect(screen.getByTestId('cell-3').textContent).toBe('6');

    await user.keyboard('{Backspace}');
    expect(spies.clear).toHaveBeenLastCalledWith(3);

    await user.keyboard('4{Delete}');
    expect(spies.clear).toHaveBeenCalledTimes(2);

    await user.keyboard('4');
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
