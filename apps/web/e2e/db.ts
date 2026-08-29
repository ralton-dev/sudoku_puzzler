/**
 * Reading the server's SQLite file straight from the test.
 *
 * The plan is explicit about this: the solution the e2e fills in comes **from
 * the database file, never from the API**. The API has no route that hands out
 * a solution, and if one is ever added, this test must not be the reason it
 * exists. Reading the file also means the assertions are about what the server
 * actually persisted rather than about what it chose to say.
 *
 * The connection is opened read-write rather than read-only on purpose: the
 * server runs the database in WAL mode, and a read-only connection to a WAL
 * database cannot create the shared-memory file it needs when it is the only
 * one left holding it. Nothing here issues anything but SELECT.
 */

import Database from 'better-sqlite3';
import { dbPath, type E2eServer } from './servers';

export interface GameRow {
  id: string;
  level: string;
  givens: string;
  solution: string;
  cells_json: string;
  elapsed_ms: number;
  started_at: string;
  completed_at: string | null;
}

function withDb<T>(server: E2eServer, fn: (db: Database.Database) => T): T {
  const db = new Database(dbPath(server));
  try {
    return fn(db);
  } finally {
    db.close();
  }
}

/** The one row with `completed_at IS NULL` (decision 8), or null. */
export function activeRow(server: E2eServer): GameRow | null {
  return withDb(
    server,
    (db) =>
      (db.prepare('SELECT * FROM games WHERE completed_at IS NULL').get() as GameRow | undefined) ??
      null,
  );
}

/** Completed rows, newest first — the same order `GET /api/history` promises. */
export function completedRows(server: E2eServer): GameRow[] {
  return withDb(
    server,
    (db) =>
      db
        .prepare('SELECT * FROM games WHERE completed_at IS NOT NULL ORDER BY completed_at DESC')
        .all() as GameRow[],
  );
}
