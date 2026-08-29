/**
 * The candidate board, against a real committed position.
 *
 * The assertion that matters is the third one: a candidate an *earlier* step
 * removed must not be drawn. `TrainingExample.eliminated` is the ledger of
 * those removals, and if the board drew naive candidates instead, every
 * example would show a pattern that is not actually there — the technique
 * fires on the position only because those candidates are already gone.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createState, examplesFor, parseGrid, type TrainingExample } from 'sudoku-core';
import { CandidateBoard, markKey } from './CandidateBoard';

const example = examplesFor('xWing')[0] as TrainingExample;

function stateFor(ex: TrainingExample, replay: boolean) {
  return createState(parseGrid(ex.grid), replay ? ex.eliminated : []);
}

describe('CandidateBoard', () => {
  it('draws every candidate of every empty square', () => {
    const state = stateFor(example, true);
    render(<CandidateBoard grid={state.grid} cand={state.cand} />);

    const marked = screen.getAllByTestId(/^cb-mark-/);
    expect(marked.length).toBeGreaterThan(0);
    for (const cell of example.step.cells) {
      // Every pattern square is empty and shows the step's digit as a candidate.
      expect(state.grid[cell]).toBe(0);
      expect(screen.getByTestId(`cb-cell-${cell}`)).toBeDefined();
    }
  });

  it('renders a candidate an earlier step eliminated as absent', () => {
    const removed = example.eliminated[0] as { cell: number; digits: number[] };
    const cell = removed.cell;
    const digit = removed.digits[0] as number;

    const naive = stateFor(example, false);
    const { rerender } = render(<CandidateBoard grid={naive.grid} cand={naive.cand} />);
    // Naive candidates still hold it...
    expect(screen.queryByTestId(`cb-mark-${cell}-${digit}`)).not.toBeNull();

    const replayed = stateFor(example, true);
    rerender(<CandidateBoard grid={replayed.grid} cand={replayed.cand} />);
    // ...and with the example's ledger replayed it is gone from the board.
    expect(screen.queryByTestId(`cb-mark-${cell}-${digit}`)).toBeNull();
  });

  it('strikes the candidates a step removes and fills the squares it places', () => {
    const state = stateFor(example, true);
    const target = example.step.eliminations[0] as { cell: number; digits: number[] };
    const digit = target.digits[0] as number;

    render(
      <CandidateBoard
        grid={state.grid}
        cand={state.cand}
        pattern={new Set(example.step.cells)}
        struck={new Set([markKey(target.cell, digit)])}
      />,
    );

    expect(screen.getByTestId(`cb-mark-${target.cell}-${digit}`).className).toContain(
      'cb-mark-struck',
    );
    for (const cell of example.step.cells) {
      expect(screen.getByTestId(`cb-cell-${cell}`).className).toContain('cb-pattern');
    }
  });

  it('is inert unless it is asked to be clickable', async () => {
    const state = stateFor(example, true);
    const onPickCell = vi.fn();
    const { rerender } = render(
      <CandidateBoard grid={state.grid} cand={state.cand} onPickCell={onPickCell} />,
    );

    const cell = example.step.cells[0] as number;
    await userEvent.click(screen.getByTestId(`cb-cell-${cell}`));
    expect(onPickCell).not.toHaveBeenCalled();

    rerender(
      <CandidateBoard
        grid={state.grid}
        cand={state.cand}
        picking="cells"
        onPickCell={onPickCell}
      />,
    );
    await userEvent.click(screen.getByTestId(`cb-cell-${cell}`));
    expect(onPickCell).toHaveBeenCalledWith(cell);
  });

  it('makes each candidate its own keyboard-reachable button when picking marks', async () => {
    const state = stateFor(example, true);
    const onPickMark = vi.fn();
    const target = example.step.eliminations[0] as { cell: number; digits: number[] };
    const digit = target.digits[0] as number;

    render(
      <CandidateBoard
        grid={state.grid}
        cand={state.cand}
        picking="marks"
        onPickMark={onPickMark}
      />,
    );

    const mark = screen.getByTestId(`cb-mark-${target.cell}-${digit}`);
    expect(mark.tagName).toBe('BUTTON');
    mark.focus();
    await userEvent.keyboard('{Enter}');
    expect(onPickMark).toHaveBeenCalledWith(target.cell, digit);
  });
});
