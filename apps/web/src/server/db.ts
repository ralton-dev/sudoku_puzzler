/**
 * SQLite, opened and migrated (decision 6).
 *
 * One file at `DATA_DIR/sudoku.db`, WAL so a reader never blocks the writer,
 * and plain numbered `.sql` files under `migrations/` applied in filename order
 * and recorded in `schema_migrations`. Nothing here knows about games; that is
 * `routes.ts`.
 */

import Database from 'better-sqlite3';
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export type Db = Database.Database;

/** `DATA_DIR` (decision 6), default `./data`. */
export function dataDir(env: NodeJS.ProcessEnv = process.env): string {
  return env.DATA_DIR && env.DATA_DIR.length > 0 ? env.DATA_DIR : './data';
}

/**
 * Where the `.sql` files live.
 *
 * Two shapes have to work: `tsx src/server/index.ts` in dev, where this module
 * is `src/server/db.ts` and the files are `src/server/migrations/`; and the
 * built bundle, where this module is inlined into `dist/server/index.js` and
 * `build:server` has copied the files to `dist/server/migrations/`. Both are
 * `./migrations` next to the module, so that candidate comes first; the others
 * are there so a different bundler layout (or WP-G's container) degrades into a
 * clear error rather than a silent "no migrations to apply".
 *
 * `MIGRATIONS_DIR` overrides everything, for anyone who lays it out otherwise.
 */
export function migrationsDir(env: NodeJS.ProcessEnv = process.env): string {
  if (env.MIGRATIONS_DIR && env.MIGRATIONS_DIR.length > 0) return env.MIGRATIONS_DIR;
  const here = fileURLToPath(new URL('.', import.meta.url));
  const candidates = [
    join(here, 'migrations'),
    join(here, '..', 'migrations'),
    join(here, '..', 'server', 'migrations'),
    join(here, '..', '..', 'src', 'server', 'migrations'),
  ];
  const found = candidates.find((dir) => existsSync(dir));
  if (!found) {
    throw new Error(`no migrations directory found; looked in:\n  ${candidates.join('\n  ')}`);
  }
  return found;
}

/**
 * Apply every migration not already in `schema_migrations`, in filename order.
 * Each file runs inside a transaction with the row that records it, so a
 * half-applied migration is not possible.
 */
export function migrate(db: Db, dir: string = migrationsDir()): string[] {
  db.exec(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       name       TEXT PRIMARY KEY,
       applied_at TEXT NOT NULL
     )`,
  );

  const applied = new Set(
    (db.prepare('SELECT name FROM schema_migrations').all() as Array<{ name: string }>).map(
      (row) => row.name,
    ),
  );

  const pending = readdirSync(dir)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .filter((name) => !applied.has(name));

  const record = db.prepare('INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)');
  for (const name of pending) {
    const sql = readFileSync(join(dir, name), 'utf8');
    db.transaction(() => {
      db.exec(sql);
      record.run(name, new Date().toISOString());
    })();
  }
  return pending;
}

/** Open (creating the directory if needed) and migrate `<dir>/sudoku.db`. */
export function openDb(dir: string = dataDir()): Db {
  mkdirSync(dir, { recursive: true });
  const db = new Database(join(dir, 'sudoku.db'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  return db;
}
