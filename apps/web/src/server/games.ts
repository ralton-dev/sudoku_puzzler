/**
 * The `games` table, in the vocabulary of the frozen contract.
 *
 * Everything that reads or writes a row lives here, so `routes.ts` is only HTTP
 * and `index.ts` can seed the awkward fixture through the same insert the
 * routes use.
 *
 * The assumption this file is written against (the plan's "assumption to hunt
 * for"): **the board is not empty when the app loads.** A row's `cells_json` is
 * the user's whole board — entered digits, pencil marks, a wrong digit and all
 * — and every read returns it verbatim. Nothing here recomputes cells from
 * `givens`; `initialCells` is used exactly once, when the row is created.
 */

import type { ActiveGame, CellState, HistoryEntry, Level } from '../shared/api.js';
import type { Db } from './db.js';

export interface GameRow {
  id: string;
  level: string;
  givens: string;
  solution: string;
  seed: number;
  cells_json: string;
  elapsed_ms: number;
  started_at: string;
  completed_at: string | null;
}

export interface NewGame {
  id: string;
  level: Level;
  givens: string;
  solution: string;
  seed: number;
  cells: CellState[];
  elapsedMs: number;
  startedAt: string;
}

/**
 * A fresh board: 81 entries, a given carrying its digit with no marks, an empty
 * cell zero. The contract insists `cells` is always length 81 and always
 * present, even on a brand-new game.
 */
export function initialCells(givens: string): CellState[] {
  return Array.from(givens, (char) => ({
    value: (char.charCodeAt(0) - 48) as CellState['value'],
    marks: [],
  }));
}

export function toActiveGame(row: GameRow): ActiveGame {
  return {
    id: row.id,
    level: row.level as Level,
    givens: row.givens,
    cells: JSON.parse(row.cells_json) as CellState[],
    elapsedMs: row.elapsed_ms,
    startedAt: row.started_at,
  };
}

export function toHistoryEntry(row: GameRow): HistoryEntry {
  return {
    id: row.id,
    level: row.level as Level,
    startedAt: row.started_at,
    completedAt: row.completed_at ?? '',
    elapsedMs: row.elapsed_ms,
    givens: row.givens,
  };
}

export function selectActive(db: Db): GameRow | undefined {
  return db.prepare('SELECT * FROM games WHERE completed_at IS NULL').get() as GameRow | undefined;
}

export function insertGame(db: Db, game: NewGame): GameRow {
  db.prepare(
    `INSERT INTO games
       (id, level, givens, solution, seed, cells_json, elapsed_ms, started_at, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
  ).run(
    game.id,
    game.level,
    game.givens,
    game.solution,
    game.seed,
    JSON.stringify(game.cells),
    game.elapsedMs,
    game.startedAt,
  );
  return db.prepare('SELECT * FROM games WHERE id = ?').get(game.id) as GameRow;
}

export function saveProgress(db: Db, id: string, cells: CellState[], elapsedMs: number): GameRow {
  db.prepare('UPDATE games SET cells_json = ?, elapsed_ms = ? WHERE id = ?').run(
    JSON.stringify(cells),
    elapsedMs,
    id,
  );
  return db.prepare('SELECT * FROM games WHERE id = ?').get(id) as GameRow;
}

export function markCompleted(db: Db, id: string, completedAt: string): GameRow {
  db.prepare('UPDATE games SET completed_at = ? WHERE id = ?').run(completedAt, id);
  return db.prepare('SELECT * FROM games WHERE id = ?').get(id) as GameRow;
}

/** Newest `completedAt` first; ties broken by insertion order, newest first. */
export function selectHistory(db: Db): GameRow[] {
  return db
    .prepare(
      'SELECT * FROM games WHERE completed_at IS NOT NULL ORDER BY completed_at DESC, rowid DESC',
    )
    .all() as GameRow[];
}

/**
 * The indices where the saved board disagrees with the stored solution
 * (decision 10). An empty cell counts as wrong, so a half-filled board reports
 * every hole.
 */
export function wrongCells(cells: CellState[], solution: string): number[] {
  const wrong: number[] = [];
  for (let i = 0; i < 81; i += 1) {
    const entered = cells[i]?.value ?? 0;
    if (entered !== solution.charCodeAt(i) - 48) wrong.push(i);
  }
  return wrong;
}
