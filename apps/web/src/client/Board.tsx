/**
 * The 9x9 grid and all of the keyboard handling.
 *
 * Keys: arrows move, 1-9 enter a digit, 0/Backspace/Delete clear, Shift+digit
 * toggles a pencil mark. The keypad's mark-mode toggle inverts the last one, so
 * a touch user gets marks without a keyboard and a keyboard user can still
 * reach the other meaning by holding Shift.
 *
 * Digits are read from `event.code` first (`Digit3`, `Numpad3`) because
 * Shift+3 arrives as `"#"` in `event.key` on most layouts — reading `key` alone
 * is exactly how a Shift+digit handler ends up silently doing nothing.
 *
 * The grid never refuses an edit for being "wrong": conflicts are highlighted,
 * not blocked. The only edit it refuses is one to a given.
 *
 * Selecting a cell that holds a digit lights every other cell holding that
 * digit (`cell-same`) — the "where else is this number" scan a player does by
 * eye, done for them. Selecting an empty cell lights nothing extra.
 *
 * **A digit that lands clears the selection.** Only a digit: clearing a cell,
 * toggling a pencil mark and moving with the arrows all keep it, because each
 * of those is something a player does repeatedly to the same square. An arrow
 * key with nothing selected still selects cell 0, which is what makes the
 * keyboard usable again straight after an entry.
 *
 * A digit already placed nine times cannot be placed a tenth time: in value
 * mode the key is simply ignored, matching the keypad's disabled button. It is
 * the only refusal besides a given, and it is not a correctness judgement —
 * conflicts stay highlighted and never blocked.
 */

import { useCallback, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { CellState, Digit } from '../shared/api';
import { Cell } from './Cell';

export interface BoardProps {
  givens: string;
  cells: readonly CellState[];
  selected: number | null;
  onSelect: (index: number | null) => void;
  conflicts: ReadonlySet<number>;
  /** how many of each digit are on the board, indexed 1-9 (`useGame`) */
  digitCounts: readonly number[];
  wrongCells: ReadonlySet<number>;
  markMode: boolean;
  onSetValue: (index: number, digit: Digit) => void;
  onToggleMark: (index: number, digit: number) => void;
  onClear: (index: number) => void;
}

/** 1-9 from a key event, tolerating Shift and the numeric keypad. */
export function digitFromKey(event: { code?: string; key: string }): number | null {
  const fromCode = /^(?:Digit|Numpad)([0-9])$/.exec(event.code ?? '');
  if (fromCode?.[1] !== undefined) return Number(fromCode[1]);
  if (/^[0-9]$/.test(event.key)) return Number(event.key);
  return null;
}

function sharesUnit(a: number, b: number): boolean {
  if (a === b) return false;
  const ra = Math.floor(a / 9);
  const rb = Math.floor(b / 9);
  const ca = a % 9;
  const cb = b % 9;
  if (ra === rb || ca === cb) return true;
  return Math.floor(ra / 3) === Math.floor(rb / 3) && Math.floor(ca / 3) === Math.floor(cb / 3);
}

export function Board({
  givens,
  cells,
  selected,
  onSelect,
  conflicts,
  digitCounts,
  wrongCells,
  markMode,
  onSetValue,
  onToggleMark,
  onClear,
}: BoardProps) {
  const gridRef = useRef<HTMLDivElement>(null);

  const isGiven = useCallback((index: number) => (givens[index] ?? '0') !== '0', [givens]);

  /** The digit under the selection, or 0 for an empty cell or no selection. */
  const selectedDigit = selected === null ? 0 : (cells[selected]?.value ?? 0);

  const move = useCallback(
    (from: number | null, dRow: number, dCol: number) => {
      if (from === null) {
        onSelect(0);
        return;
      }
      const row = Math.min(8, Math.max(0, Math.floor(from / 9) + dRow));
      const col = Math.min(8, Math.max(0, (from % 9) + dCol));
      onSelect(row * 9 + col);
    },
    [onSelect],
  );

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      switch (event.key) {
        case 'ArrowUp':
          event.preventDefault();
          move(selected, -1, 0);
          return;
        case 'ArrowDown':
          event.preventDefault();
          move(selected, 1, 0);
          return;
        case 'ArrowLeft':
          event.preventDefault();
          move(selected, 0, -1);
          return;
        case 'ArrowRight':
          event.preventDefault();
          move(selected, 0, 1);
          return;
        default:
          break;
      }

      if (selected === null) return;

      if (event.key === 'Backspace' || event.key === 'Delete') {
        event.preventDefault();
        if (!isGiven(selected)) onClear(selected);
        return;
      }

      const digit = digitFromKey(event);
      if (digit === null) return;
      event.preventDefault();
      if (isGiven(selected)) return;

      if (digit === 0) {
        onClear(selected);
        return;
      }
      // Shift inverts mark-mode rather than always meaning "mark", so both
      // input styles stay reachable at once.
      const wantsMark = event.shiftKey !== markMode;
      if (wantsMark) {
        onToggleMark(selected, digit);
        return;
      }
      // All nine are already on the board. A mark would still have been fine —
      // that branch is above — but there is no tenth 7 to place.
      if ((digitCounts[digit] ?? 0) >= 9) return;
      onSetValue(selected, digit as Digit);
      onSelect(null);
    },
    [digitCounts, isGiven, markMode, move, onClear, onSelect, onSetValue, onToggleMark, selected],
  );

  const select = useCallback(
    (index: number) => {
      onSelect(index);
      gridRef.current?.focus();
    },
    [onSelect],
  );

  return (
    <div
      ref={gridRef}
      role="grid"
      aria-label="sudoku board"
      data-testid="board"
      className="board"
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      {Array.from({ length: 81 }, (_, index) => {
        const cell = cells[index] ?? { value: 0 as Digit, marks: [] };
        return (
          <Cell
            key={index}
            index={index}
            cell={cell}
            given={isGiven(index)}
            selected={selected === index}
            peer={selected !== null && sharesUnit(selected, index)}
            sameDigit={selectedDigit !== 0 && cell.value === selectedDigit && index !== selected}
            conflict={conflicts.has(index)}
            wrong={wrongCells.has(index)}
            onSelect={select}
          />
        );
      })}
    </div>
  );
}
