/**
 * The touch half of the input, tested on its own.
 *
 * Everything the keyboard can do the keypad must do identically — that is the
 * whole contract between this file and `Board.test.tsx`. Where the two differ
 * the difference is a bug, so the cases here are deliberately the same cases.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Keypad } from './Keypad';

interface Spies {
  setValue: ReturnType<typeof vi.fn>;
  toggleMark: ReturnType<typeof vi.fn>;
  clear: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  markMode: ReturnType<typeof vi.fn>;
}

function setup(options: { markMode?: boolean; selected?: number | null; locked?: boolean } = {}) {
  const spies: Spies = {
    setValue: vi.fn(),
    toggleMark: vi.fn(),
    clear: vi.fn(),
    select: vi.fn(),
    markMode: vi.fn(),
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
