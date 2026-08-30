/**
 * The touch half of the input, tested on its own.
 *
 * Everything the keyboard can do the keypad must do identically — that is the
 * whole contract between this file and `Board.test.tsx`. Where the two differ
 * the difference is a bug, so the cases here are deliberately the same cases.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, type Mock } from 'vitest';
import type { Digit } from '../shared/api';
import { Keypad } from './Keypad';

// See the note in `Board.test.tsx`: from Vitest 4 a bare `vi.fn()` is callable
// or constructable, so each spy carries the signature of the prop it stands in
// for. The two files deliberately mirror each other.
interface Spies {
  setValue: Mock<(index: number, digit: Digit) => void>;
  toggleMark: Mock<(index: number, digit: number) => void>;
  clear: Mock<(index: number) => void>;
  select: Mock<(index: number | null) => void>;
  markMode: Mock<(next: boolean) => void>;
}

/** A count table with the given digits set; everything else at zero. */
function counts(overrides: Record<number, number> = {}): number[] {
  const table = Array.from({ length: 10 }, () => 0);
  for (const [digit, n] of Object.entries(overrides)) table[Number(digit)] = n;
  return table;
}

function setup(
  options: {
    markMode?: boolean;
    selected?: number | null;
    locked?: boolean;
    digitCounts?: number[];
  } = {},
) {
  const spies: Spies = {
    setValue: vi.fn<(index: number, digit: Digit) => void>(),
    toggleMark: vi.fn<(index: number, digit: number) => void>(),
    clear: vi.fn<(index: number) => void>(),
    select: vi.fn<(index: number | null) => void>(),
    markMode: vi.fn<(next: boolean) => void>(),
  };
  const user = userEvent.setup();
  render(
    <Keypad
      selected={options.selected === undefined ? 40 : options.selected}
      markMode={options.markMode ?? false}
      onMarkModeChange={spies.markMode}
      onSetValue={spies.setValue}
      onToggleMark={spies.toggleMark}
      onClear={spies.clear}
      onSelect={spies.select}
      digitCounts={options.digitCounts ?? counts()}
      locked={options.locked ?? false}
    />,
  );
  return { spies, user };
}

describe('selection after a keypad press', () => {
  it('drops the selection once a digit lands', async () => {
    const { spies, user } = setup();

    await user.click(screen.getByRole('button', { name: /^enter 4/ }));

    expect(spies.setValue).toHaveBeenCalledWith(40, 4);
    expect(spies.select).toHaveBeenCalledWith(null);
  });

  it('keeps the selection for a pencil mark', async () => {
    const { spies, user } = setup({ markMode: true });

    await user.click(screen.getByRole('button', { name: /^toggle mark 4/ }));

    expect(spies.toggleMark).toHaveBeenCalledWith(40, 4);
    expect(spies.setValue).not.toHaveBeenCalled();
    expect(spies.select).not.toHaveBeenCalled();
  });

  it('keeps the selection when Erase clears the cell', async () => {
    const { spies, user } = setup();

    await user.click(screen.getByRole('button', { name: 'clear cell' }));

    expect(spies.clear).toHaveBeenCalledWith(40);
    expect(spies.select).not.toHaveBeenCalled();
  });
});

describe('the count on each key', () => {
  it('badges every digit with how many are on the board, and says it in the label too', () => {
    setup({ digitCounts: counts({ 3: 3, 4: 9, 7: 0 }) });

    const three = screen.getByRole('button', { name: 'enter 3, three placed' });
    const badge = three.querySelector('.keypad-count');
    expect(badge?.textContent).toBe('3');
    // The badge is decoration; the label is the accessible copy of it.
    expect(badge?.getAttribute('aria-hidden')).toBe('true');

    expect(screen.getByRole('button', { name: 'enter 7, none placed' })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'enter 4, nine placed' }).querySelector('.keypad-count')
        ?.textContent,
    ).toBe('9');
  });

  it('disables a digit that is already placed nine times, keeping its label', () => {
    setup({ digitCounts: counts({ 4: 9, 3: 8 }) });

    const four = screen.getByRole('button', { name: 'enter 4, nine placed' }) as HTMLButtonElement;
    expect(four.disabled).toBe(true);
    expect(four.className).toContain('keypad-key-full');

    const three = screen.getByRole('button', {
      name: 'enter 3, eight placed',
    }) as HTMLButtonElement;
    expect(three.disabled).toBe(false);
  });

  it('keeps a completed digit pressable in mark mode — a mark is not a placement', async () => {
    const { spies, user } = setup({ markMode: true, digitCounts: counts({ 4: 9 }) });

    const four = screen.getByRole('button', {
      name: 'toggle mark 4, nine placed',
    }) as HTMLButtonElement;
    expect(four.disabled).toBe(false);

    await user.click(four);
    expect(spies.toggleMark).toHaveBeenCalledWith(40, 4);
  });

  it('disables everything while nothing is selected, whatever the counts say', () => {
    setup({ selected: null, digitCounts: counts({ 4: 2 }) });

    const four = screen.getByRole('button', { name: 'enter 4, two placed' }) as HTMLButtonElement;
    expect(four.disabled).toBe(true);
  });
});
