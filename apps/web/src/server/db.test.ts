/**
 * The database's own guarantees, below the HTTP layer.
 *
 * The route returns 409 on a second create; the partial unique index is what
 * makes that *true* rather than merely usually true. The plan says if the two
 * ever disagree the index wins, so it is tested by writing straight through
 * better-sqlite3 with no route involved.
 */

import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { migrate, migrationsDir, openDb, type Db } from './db.js';

let dir: string;
let db: Db;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'sudoku-wpe-db-'));
  db = openDb(dir);
});
afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

const insertGameRow = (id: string, completedAt: string | null): void => {
  db.prepare(
    `INSERT INTO games
       (id, level, givens, solution, seed, cells_json, elapsed_ms, started_at, completed_at)
     VALUES (?, 'easy', ?, ?, 0, '[]', 0, '2026-08-29T00:00:00.000Z', ?)`,
  ).run(id, '0'.repeat(81), '1'.repeat(81), completedAt);
};

describe('migrations', () => {
  it('finds its .sql files from wherever the module is running', () => {
    const files = readdirSync(migrationsDir()).filter((name) => name.endsWith('.sql'));
    expect(files).toContain('001_init.sql');
  });

  it('applies each file exactly once and records it', () => {
    const applied = db.prepare('SELECT name FROM schema_migrations ORDER BY name').all() as Array<{
      name: string;
    }>;
    expect(applied.map((row) => row.name)).toEqual(['001_init.sql']);

    // openDb already migrated; a second pass must be a no-op, not an error.
    expect(migrate(db)).toEqual([]);
  });

  it('opens in WAL mode (decision 6)', () => {
    expect(String(db.pragma('journal_mode', { simple: true })).toLowerCase()).toBe('wal');
  });
});

describe('one active game, at the DB level (decision 8)', () => {
  it('refuses a second row with completed_at IS NULL, inserted directly', () => {
    insertGameRow('first', null);
    expect(() => insertGameRow('second', null)).toThrowError(/UNIQUE constraint failed/);
    expect(db.prepare('SELECT count(*) AS n FROM games WHERE completed_at IS NULL').get()).toEqual({
      n: 1,
    });
  });

  it('allows any number of completed rows alongside one active one', () => {
    insertGameRow('done-1', '2026-08-01T10:00:00.000Z');
    insertGameRow('done-2', '2026-08-02T10:00:00.000Z');
    insertGameRow('done-3', '2026-08-03T10:00:00.000Z');
    insertGameRow('active', null);
    expect(db.prepare('SELECT count(*) AS n FROM games').get()).toEqual({ n: 4 });
  });

  it('frees the slot again once the active row is completed', () => {
    insertGameRow('first', null);
    db.prepare('UPDATE games SET completed_at = ? WHERE id = ?').run(
      '2026-08-29T12:00:00.000Z',
      'first',
    );
    expect(() => insertGameRow('second', null)).not.toThrow();
  });
});
