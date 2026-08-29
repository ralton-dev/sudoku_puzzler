/**
 * One square. Renders a given, a user digit, or the pencil marks.
 *
 * A filled cell keeps its marks in state (see `useGame.setValue`) and simply
 * stops showing them; that is what makes a resumed board look like the one the
 * player left rather than a tidied-up version of it.
 */

import type { CellState } from '../shared/api';

export interface CellProps {
  index: number;
  cell: CellState;
  given: boolean;
  selected: boolean;
  /** shares a row, column or box with the selected cell */
  peer: boolean;
  conflict: boolean;
  wrong: boolean;
  onSelect: (index: number) => void;
}

function describe(cell: CellState, given: boolean, index: number): string {
  const row = Math.floor(index / 9) + 1;
  const col = (index % 9) + 1;
  const where = `row ${row} column ${col}`;
  if (cell.value !== 0) return `${where}, ${given ? 'given' : 'entered'} ${cell.value}`;
  if (cell.marks.length > 0) return `${where}, empty, marks ${cell.marks.join(' ')}`;
  return `${where}, empty`;
}

export function Cell({ index, cell, given, selected, peer, conflict, wrong, onSelect }: CellProps) {
  const classes = ['cell'];
  if (given) classes.push('cell-given');
  if (selected) classes.push('cell-selected');
  else if (peer) classes.push('cell-peer');
  if (conflict) classes.push('cell-conflict');
  if (wrong) classes.push('cell-wrong');

  return (
    <div
      role="gridcell"
      className={classes.join(' ')}
      data-index={index}
      data-testid={`cell-${index}`}
      aria-selected={selected}
      aria-readonly={given}
      aria-label={describe(cell, given, index)}
      onPointerDown={(event) => {
        event.preventDefault();
        onSelect(index);
      }}
    >
      {cell.value !== 0 ? (
        <span className="cell-value">{cell.value}</span>
      ) : cell.marks.length > 0 ? (
        <span className="cell-marks" aria-hidden="true">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
            <span key={d} className={cell.marks.includes(d) ? 'mark mark-on' : 'mark'}>
              {cell.marks.includes(d) ? d : ''}
            </span>
          ))}
        </span>
      ) : null}
    </div>
  );
}
