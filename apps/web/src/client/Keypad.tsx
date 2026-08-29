/**
 * Touch input. Everything the keyboard can do, without one.
 *
 * The mark-mode toggle is the whole reason this exists: on a phone there is no
 * Shift to hold, so mark-mode is a sticky state and the digit buttons change
 * meaning with it. Holding Shift on a keyboard inverts it (see `Board`), so the
 * two never fight.
 *
 * Each key carries a count of how many of that digit are on the board, and a
 * digit that is already placed nine times is disabled — in value mode only.
 * Mark mode keeps every key live, because a pencil mark is a note, not a
 * placement, and a player marks candidates for digits they have finished
 * placing all the time. `Board`'s keyboard path makes the same distinction.
 *
 * Entering a digit clears the selection here exactly as it does on the
 * keyboard. The rule is duplicated in the two input surfaces rather than
 * hoisted into `App`, because it belongs to the act of entering a digit and
 * `App` is only the place the selection happens to be stored — hiding it there
 * would make the keypad and the keyboard able to disagree without saying so.
 */

import type { Digit } from '../shared/api';

/** All nine of a digit are on the board; there is no tenth one to place. */
const COMPLETE = 9;

/**
 * Counts as words in the accessible label. "enter 3, 3 placed" is read as two
 * unrelated numbers; "enter 3, three placed" is a sentence.
 */
const SPELLED = ['none', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

const spell = (count: number): string => SPELLED[count] ?? String(count);

export interface KeypadProps {
  selected: number | null;
  markMode: boolean;
  onMarkModeChange: (next: boolean) => void;
  onSetValue: (index: number, digit: Digit) => void;
  onToggleMark: (index: number, digit: number) => void;
  onClear: (index: number) => void;
  /** same signature as `Board`'s: a digit press clears the selection with null */
  onSelect: (index: number | null) => void;
  /** how many of each digit are on the board, indexed 1-9 (`useGame`) */
  digitCounts: readonly number[];
  /** the selected cell is a given, so nothing can be entered into it */
  locked: boolean;
}

export function Keypad({
  selected,
  markMode,
  onMarkModeChange,
  onSetValue,
  onToggleMark,
  onClear,
  onSelect,
  digitCounts,
  locked,
}: KeypadProps) {
  const disabled = selected === null || locked;

  return (
    <div className="keypad">
      <div className="keypad-digits">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => {
          const count = digitCounts[digit] ?? 0;
          const full = count >= COMPLETE;
          const verb = markMode ? `toggle mark ${digit}` : `enter ${digit}`;
          return (
            <button
              key={digit}
              type="button"
              className={full ? 'keypad-key keypad-key-full' : 'keypad-key'}
              disabled={disabled || (full && !markMode)}
              aria-label={`${verb}, ${spell(count)} placed`}
              onClick={() => {
                if (selected === null) return;
                if (markMode) {
                  onToggleMark(selected, digit);
                  return;
                }
                onSetValue(selected, digit as Digit);
                onSelect(null);
              }}
            >
              {digit}
              <span className="keypad-count" aria-hidden="true">
                {count}
              </span>
            </button>
          );
        })}
      </div>
      <div className="keypad-actions">
        <button
          type="button"
          className={markMode ? 'keypad-toggle keypad-toggle-on' : 'keypad-toggle'}
          aria-pressed={markMode}
          onClick={() => onMarkModeChange(!markMode)}
        >
          Pencil marks
        </button>
        <button
          type="button"
          className="keypad-key keypad-erase"
          disabled={disabled}
          aria-label="clear cell"
          onClick={() => {
            if (selected !== null) onClear(selected);
          }}
        >
          Erase
        </button>
      </div>
    </div>
  );
}
