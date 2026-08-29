/**
 * A read-only board that draws the candidates.
 *
 * Deliberately **not** the game's `Board`/`Cell` (the plan says so, and the
 * reason is in `Cell.tsx`): the game hides pencil marks behind an entered
 * digit, because a resumed board should look like the one the player left. A
 * teaching board wants the opposite — every empty square shows every candidate
 * it still has, always, because the candidates *are* the lesson. Sharing the
 * component would have meant a mode flag on the game board and a second meaning
 * for `marks`, on the one component whose behaviour a whole work package exists
 * to protect.
 *
 * It renders whatever state it is handed and owns none of it. There is no game
 * here, no timer, no save: `grid` and `cand` come from
 * `createState(parseGrid(example.grid), example.eliminated)` in the page above,
 * which is pure library code (decision 18 — training touches nothing).
 *
 * ## Interaction
 *
 * `picking` decides what is clickable, and the DOM changes with it so that the
 * keyboard follows for free:
 *
 *   - `'none'`   — plain divs. Nothing is focusable.
 *   - `'cells'`  — each square is a `<button>`; Tab reaches it, Enter/Space
 *                  toggles it, and `aria-selected` says whether it is picked.
 *   - `'marks'`  — each *candidate digit* is a `<button aria-pressed>`, which is
 *                  the smaller target and the one the practise flow needs at
 *                  the second stage.
 *
 * Buttons rather than click handlers on divs is the whole of the accessibility
 * story here, and it is enough: the practise flow is reachable and operable
 * with a keyboard alone, and every control names itself ("row 3 column 8,
 * candidate 7") rather than relying on the grid geometry being visible.
 */

import { digitsOf } from 'sudoku-core';

/** `${cell}:${digit}` — the identity of one candidate on the board. */
export function markKey(cell: number, digit: number): string {
  return `${cell}:${digit}`;
}

/** `r3c8`, 1-based, the way a person reads a board. */
export function cellLabel(cell: number): string {
  return `r${Math.floor(cell / 9) + 1}c${(cell % 9) + 1}`;
}

/** `row 3 column 8` — the spoken form, for `aria-label`. */
function spokenCell(cell: number): string {
  return `row ${Math.floor(cell / 9) + 1} column ${(cell % 9) + 1}`;
}

export type Picking = 'none' | 'cells' | 'marks';

export interface CandidateBoardProps {
  /** 81 entries, 0 = empty */
  grid: Uint8Array;
  /** 81 candidate bitmasks (digit `d` is bit `d - 1`); 0 for a filled square */
  cand: Int32Array;
  /** squares drawn as the pattern */
  pattern?: ReadonlySet<number>;
  /** candidates drawn struck through — `markKey` values */
  struck?: ReadonlySet<string>;
  /** squares the step fills in, `cell -> digit` */
  placed?: ReadonlyMap<number, number>;
  picking?: Picking;
  pickedCells?: ReadonlySet<number>;
  pickedMarks?: ReadonlySet<string>;
  onPickCell?: (cell: number) => void;
  onPickMark?: (cell: number, digit: number) => void;
  label?: string;
}

const EMPTY_CELLS: ReadonlySet<number> = new Set<number>();
const EMPTY_MARKS: ReadonlySet<string> = new Set<string>();
const NO_PLACEMENTS: ReadonlyMap<number, number> = new Map<number, number>();

export function CandidateBoard({
  grid,
  cand,
  pattern = EMPTY_CELLS,
  struck = EMPTY_MARKS,
  placed = NO_PLACEMENTS,
  picking = 'none',
  pickedCells = EMPTY_CELLS,
  pickedMarks = EMPTY_MARKS,
  onPickCell,
  onPickMark,
  label = 'candidate board',
}: CandidateBoardProps) {
  return (
    <div role="grid" aria-label={label} data-testid="candidate-board" className="cboard">
      {Array.from({ length: 81 }, (_, cell) => (
        <Square
          key={cell}
          cell={cell}
          digit={grid[cell] ?? 0}
          candidates={digitsOf(cand[cell] ?? 0)}
          inPattern={pattern.has(cell)}
          placedDigit={placed.get(cell)}
          struck={struck}
          picking={picking}
          picked={pickedCells.has(cell)}
          pickedMarks={pickedMarks}
          onPickCell={onPickCell}
          onPickMark={onPickMark}
        />
      ))}
    </div>
  );
}

interface SquareProps {
  cell: number;
  digit: number;
  candidates: number[];
  inPattern: boolean;
  placedDigit: number | undefined;
  struck: ReadonlySet<string>;
  picking: Picking;
  picked: boolean;
  pickedMarks: ReadonlySet<string>;
  onPickCell?: (cell: number) => void;
  onPickMark?: (cell: number, digit: number) => void;
}

function Square({
  cell,
  digit,
  candidates,
  inPattern,
  placedDigit,
  struck,
  picking,
  picked,
  pickedMarks,
  onPickCell,
  onPickMark,
}: SquareProps) {
  const classes = ['cb-cell'];
  if (digit !== 0) classes.push('cb-filled');
  if (inPattern) classes.push('cb-pattern');
  if (picked) classes.push('cb-picked');
  if (placedDigit !== undefined) classes.push('cb-placed');

  const described =
    digit !== 0
      ? `${spokenCell(cell)}, ${digit}`
      : placedDigit !== undefined
        ? `${spokenCell(cell)}, place ${placedDigit}`
        : candidates.length > 0
          ? `${spokenCell(cell)}, candidates ${candidates.join(' ')}`
          : `${spokenCell(cell)}, no candidates`;

  const body =
    digit !== 0 ? (
      <span className="cb-value">{digit}</span>
    ) : placedDigit !== undefined ? (
      <span className="cb-value cb-value-placed">{placedDigit}</span>
    ) : (
      <span className="cb-marks">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => {
          const has = candidates.includes(d);
          if (!has) return <span key={d} className="cb-mark" />;
          const key = markKey(cell, d);
          const markClasses = ['cb-mark', 'cb-mark-on'];
          if (struck.has(key)) markClasses.push('cb-mark-struck');
          if (pickedMarks.has(key)) markClasses.push('cb-mark-picked');
          if (picking === 'marks') {
            return (
              <button
                key={d}
                type="button"
                className={markClasses.join(' ')}
                data-testid={`cb-mark-${cell}-${d}`}
                aria-pressed={pickedMarks.has(key)}
                aria-label={`${spokenCell(cell)}, candidate ${d}`}
                onClick={() => onPickMark?.(cell, d)}
              >
                {d}
              </button>
            );
          }
          return (
            <span key={d} className={markClasses.join(' ')} data-testid={`cb-mark-${cell}-${d}`}>
              {d}
            </span>
          );
        })}
      </span>
    );

  if (picking === 'cells') {
    return (
      <button
        type="button"
        role="gridcell"
        aria-selected={picked}
        aria-label={described}
        className={classes.join(' ')}
        data-testid={`cb-cell-${cell}`}
        onClick={() => onPickCell?.(cell)}
      >
        {body}
      </button>
    );
  }

  return (
    <div
      role="gridcell"
      aria-label={described}
      aria-selected={picked || inPattern}
      className={classes.join(' ')}
      data-testid={`cb-cell-${cell}`}
    >
      {body}
    </div>
  );
}
