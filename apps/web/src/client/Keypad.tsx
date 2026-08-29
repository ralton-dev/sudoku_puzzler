/**
 * Touch input. Everything the keyboard can do, without one.
 *
 * The mark-mode toggle is the whole reason this exists: on a phone there is no
 * Shift to hold, so mark-mode is a sticky state and the digit buttons change
 * meaning with it. Holding Shift on a keyboard inverts it (see `Board`), so the
 * two never fight.
 *
 * Entering a digit clears the selection here exactly as it does on the
 * keyboard. The rule is duplicated in the two input surfaces rather than
 * hoisted into `App`, because it belongs to the act of entering a digit and
 * `App` is only the place the selection happens to be stored — hiding it there
 * would make the keypad and the keyboard able to disagree without saying so.
 */

import type { Digit } from '../shared/api';

export interface KeypadProps {
  selected: number | null;
  markMode: boolean;
  onMarkModeChange: (next: boolean) => void;
  onSetValue: (index: number, digit: Digit) => void;
  onToggleMark: (index: number, digit: number) => void;
  onClear: (index: number) => void;
  /** same signature as `Board`'s: a digit press clears the selection with null */
  onSelect: (index: number | null) => void;
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
  locked,
}: KeypadProps) {
  const disabled = selected === null || locked;

  return (
    <div className="keypad">
      <div className="keypad-digits">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
          <button
            key={digit}
            type="button"
            className="keypad-key"
            disabled={disabled}
            aria-label={markMode ? `toggle mark ${digit}` : `enter ${digit}`}
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
          </button>
        ))}
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
