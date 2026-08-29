/**
 * The awkward fixture — the plan's "fixture shape this plan's tests avoid".
 *
 * A tidy test uses a fresh game and fills it in order. The state that actually
 * breaks things is the one this file builds: a puzzle **one cell from complete,
 * with one wrong digit and six pencil marks in the same box, and a timer
 * already past an hour**, met for the first time on a page load rather than
 * built up by the client.
 *
 * Seeded straight into the DB by `SUDOKU_FIXTURE=awkward` on boot (and replayed
 * by WP-G's e2e), so the client's first sight of the board is a half-finished
 * one — which is exactly the assumption the plan says to hunt for.
 */

import { randomUUID } from 'node:crypto';
import type { CellState, Digit } from '../shared/api.js';
import type { Db } from './db.js';
import { insertGame, selectActive } from './games.js';
import { fixturePuzzleSource } from './puzzleSource.js';

/** 1h 2m 5s — past the hour, and not a round number. */
export const AWKWARD_ELAPSED_MS = 3_725_000;

const boxOf = (index: number): number =>
  Math.floor(Math.floor(index / 9) / 3) * 3 + Math.floor((index % 9) / 3);

const cellsOfBox = (box: number): number[] => {
  const out: number[] = [];
  for (let i = 0; i < 81; i += 1) if (boxOf(i) === box) out.push(i);
  return out;
};

export interface AwkwardState {
  level: 'easy';
  givens: string;
  solution: string;
  cells: CellState[];
  elapsedMs: number;
  /** the one cell still empty */
  emptyCell: number;
  /** the one filled cell holding a digit that is not the solution's */
  wrongCell: number;
  /** the cells carrying pencil marks — all in one box, six marks between them */
  markedCells: number[];
}

/** Build the state without touching the database. */
export function buildAwkwardState(): AwkwardState {
  const { givens, solution } = fixturePuzzleSource.generate('easy');
  const digitAt = (i: number): Digit => (solution.charCodeAt(i) - 48) as Digit;

  const cells: CellState[] = Array.from({ length: 81 }, (_unused, i) => ({
    value: digitAt(i),
    marks: [] as number[],
  }));

  const empties = [...givens].map((c, i) => (c === '0' ? i : -1)).filter((i) => i >= 0);
  const emptyCell = empties[empties.length - 1] as number;
  const box = boxOf(emptyCell);
  const openInBox = cellsOfBox(box).filter((i) => givens[i] === '0');

  // Still empty: the last hole on the board.
  (cells[emptyCell] as CellState).value = 0;

  // One wrong digit, in the same box as the hole, so the "you're not done"
  // 409 and the pencil marks are tangled together rather than tidily apart.
  const wrongCell = openInBox.find((i) => i !== emptyCell) as number;
  const right = digitAt(wrongCell);
  (cells[wrongCell] as CellState).value = ((right % 9) + 1) as Digit;

  // Six pencil marks, all inside that same box.
  const markPlan: number[][] = [[2, 5, 8], [3, 6], [9]];
  const markedCells: number[] = [];
  const targets = openInBox.slice(0, markPlan.length);
  markPlan.forEach((marks, i) => {
    const cell = targets[i] ?? (targets[targets.length - 1] as number);
    const state = cells[cell] as CellState;
    state.marks = [...new Set([...state.marks, ...marks])].sort((a, b) => a - b);
    if (!markedCells.includes(cell)) markedCells.push(cell);
  });

  return {
    level: 'easy',
    givens,
    solution,
    cells,
    elapsedMs: AWKWARD_ELAPSED_MS,
    emptyCell,
    wrongCell,
    markedCells,
  };
}

/**
 * Seed it as the active game. No-op (returns `false`) when a game is already
 * active — decision 8 has no abandon endpoint, so a boot must never displace
 * whatever the user was playing.
 */
export function seedAwkwardGame(db: Db): boolean {
  if (selectActive(db)) return false;
  const state = buildAwkwardState();
  insertGame(db, {
    id: randomUUID(),
    level: state.level,
    givens: state.givens,
    solution: state.solution,
    seed: 0,
    cells: state.cells,
    elapsedMs: state.elapsedMs,
    startedAt: new Date(Date.now() - state.elapsedMs).toISOString(),
  });
  return true;
}
