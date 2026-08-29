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

describe('locking mode (homelab contract §6 — WAL on NFS)', () => {
  const pragma = (handle: Db, name: string): string =>
    String(handle.pragma(name, { simple: true })).toLowerCase();

  it('takes the exclusive lock by default, on top of WAL, with a busy timeout', () => {
    expect(pragma(db, 'journal_mode')).toBe('wal');
    expect(pragma(db, 'locking_mode')).toBe('exclusive');
    // The grace window for the pod replacing this one, which may open the file
    // a moment before the old process has released it.
    expect(db.pragma('busy_timeout', { simple: true })).toBe(5000);
  });

  it('never creates a -shm file — which is the whole reason for the pragma', () => {
    // WAL's shared-memory index is only coherent between processes on one
    // host, so a `-shm` file on an NFS volume is the documented unsafe case.
    // Exclusive locking keeps that index in heap memory instead, and the
    // observable consequence is this: the file is never created.
    insertGameRow('writes-something', null);
    expect(readdirSync(dir).filter((name) => name.endsWith('-shm'))).toEqual([]);
  });

  it('still creates no -shm when it REOPENS a database that already exists', () => {
    // The case the fresh-file test above cannot see, and the one that is true
    // of every boot after the first: a pod restarting onto its volume. If the
    // WAL pragma runs before the locking pragma, reading the existing header
    // is a WAL-mode access and the `-shm` file is created before exclusive
    // locking can prevent it — while `locking_mode` still reads back
    // `exclusive`, so this file's other assertions all stay green.
    insertGameRow('written-before-the-restart', null);
    db.close();

    db = openDb(dir);
    expect(pragma(db, 'locking_mode')).toBe('exclusive');
    expect(db.prepare('SELECT count(*) AS n FROM games').get()).toEqual({ n: 1 });
    insertGameRow('written-after-the-restart', '2026-08-29T12:00:00.000Z');
    expect(readdirSync(dir).filter((name) => name.endsWith('-shm'))).toEqual([]);
  });

  it('leaves locking normal when SQLITE_EXCLUSIVE=false, so another process can read', () => {
    const other = mkdtempSync(join(tmpdir(), 'sudoku-wpe-db-shared-'));
    const shared = openDb(other, { SQLITE_EXCLUSIVE: 'false' });
    try {
      expect(pragma(shared, 'journal_mode')).toBe('wal');
      expect(pragma(shared, 'locking_mode')).toBe('normal');
    } finally {
      shared.close();
      rmSync(other, { recursive: true, force: true });
    }
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
