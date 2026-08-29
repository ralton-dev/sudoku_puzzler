/**
 * SQLite, opened and migrated (decision 6).
 *
 * One file at `DATA_DIR/sudoku.db`, WAL so a reader never blocks the writer,
 * exclusively locked so WAL is safe on the NFS volume it lives on in the home
 * lab, and plain numbered `.sql` files under `migrations/` applied in filename
 * order and recorded in `schema_migrations`. Nothing here knows about games;
 * that is `routes.ts`.
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

/**
 * Whether to take the exclusive lock — `SQLITE_EXCLUSIVE`, **default on**.
 *
 * On by default because the deployment is the case that must not be got wrong,
 * and a flag you have to remember to set is a flag that ships unset. The one
 * caller that turns it off is `apps/web/e2e`, which reads the solution out of
 * the running server's database file from a second process (`e2e/db.ts`), and
 * cannot while the server holds the lock.
 *
 * That conflict is real and was measured rather than assumed: with the pragma
 * set, a second connection — same process or another, read-write **or**
 * read-only, against a completely quiescent database — fails immediately with
 * `SQLITE_BUSY: database is locked`. SQLite takes the lock on first access and
 * never lets go, so "acquire it lazily on first write and let readers in
 * meanwhile" is not a behaviour that exists. An environment switch is
 * therefore the only way to keep both the NFS guarantee and that e2e.
 */
export function exclusiveLocking(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.SQLITE_EXCLUSIVE !== 'false';
}

/** Open (creating the directory if needed) and migrate `<dir>/sudoku.db`. */
export function openDb(dir: string = dataDir(), env: NodeJS.ProcessEnv = process.env): Db {
  mkdirSync(dir, { recursive: true });
  const db = new Database(join(dir, 'sudoku.db'));
  if (exclusiveLocking(env)) {
    // Single process; keeps the WAL index in heap so `-shm` is never used;
    // makes WAL safe on NFS. Trade-off: no concurrent external readers — while
    // this server is up, `sqlite3 /data/sudoku.db` from a debug shell gets
    // `database is locked`. Stop the pod, or copy the file first.
    //
    // BEFORE the WAL pragma, not after, and the difference is invisible until
    // it matters. SQLite only keeps the WAL index in heap if exclusive locking
    // is set before the *first WAL-mode access* — and on an existing database
    // `PRAGMA journal_mode` is itself one, because it has to read the header to
    // answer. So on a fresh file either order works, and on the second boot
    // onto a volume that already holds the database — every pod restart —
    // WAL-then-EXCLUSIVE creates the `-shm` file anyway. `locking_mode` still
    // reads back `exclusive` in that state, so the pragma test passes while the
    // guarantee it stands for is gone. Measured; `db.test.ts` reopens.
    db.pragma('locking_mode = EXCLUSIVE');
  }
  db.pragma('journal_mode = WAL');
  // Outside the branch on purpose: it is the grace window for the *next*
  // process, which may reach the file a moment before the one being replaced
  // has let go of it.
  db.pragma('busy_timeout = 5000');
  db.pragma('foreign_keys = ON');
  migrate(db);
  return db;
}
