/**
 * The two servers the e2e boots, and where their SQLite files live.
 *
 * Both are the **built** artefact — `node dist/server/index.js` — not `tsx`
 * against the sources, because the thing WP-G has to prove is that what the
 * container runs works, not that the TypeScript does. `pnpm --filter web e2e`
 * builds first for that reason.
 *
 * Two servers rather than one because the two specs need incompatible boots:
 * `game.spec.ts` is production (no `SUDOKU_FIXTURE`, real `generate()`), and
 * `awkward.spec.ts` needs `SUDOKU_FIXTURE=awkward`, which is a boot-time
 * decision (`main()` seeds the awkward row before it listens). Each gets its
 * own port and its own `DATA_DIR`, wiped by the `webServer` command, so every
 * run starts from a database that does not exist yet — the plan's "fresh DB".
 *
 * Ports are deliberately far from 8080/5173: a developer's own server may be
 * running while the suite is.
 *
 * Both boots also set `SQLITE_EXCLUSIVE=false`. The
 * shipped default is `true` — `locking_mode = EXCLUSIVE`, which is what makes
 * WAL safe on the home lab's NFS volume (contract §6) — and the price of it is
 * that no second process can open the file at all, not even read-only, not
 * even while the database is idle. `e2e/db.ts` is exactly such a process: the
 * plan requires the solution to come from the file rather than from the API,
 * so the suite opts out and the production default stays on. The one thing
 * this costs is that the e2e does not exercise the locking mode the container
 * uses; `db.test.ts` covers that pragma directly instead.
 */

import { join } from 'node:path';
import { tmpdir } from 'node:os';

export interface E2eServer {
  readonly name: string;
  readonly port: number;
  /** wiped before every boot */
  readonly dataDir: string;
  readonly env: Readonly<Record<string, string>>;
}

const dataRoot = join(tmpdir(), 'sudoku-puzzler-e2e');

export const PRODUCTION: E2eServer = {
  name: 'production',
  port: 18090,
  dataDir: join(dataRoot, 'production'),
  // No SUDOKU_FIXTURE: this is the real generator, first contact with the real
  // server. Anything the fixtures paper over shows up here.
  env: { SQLITE_EXCLUSIVE: 'false' },
};

export const AWKWARD: E2eServer = {
  name: 'awkward',
  port: 18091,
  dataDir: join(dataRoot, 'awkward'),
  env: { SUDOKU_FIXTURE: 'awkward', SQLITE_EXCLUSIVE: 'false' },
};

export const baseUrl = (server: E2eServer): string => `http://127.0.0.1:${server.port}`;

/** The SQLite file the spec opens directly — solutions are read from here, never from the API. */
export const dbPath = (server: E2eServer): string => join(server.dataDir, 'sudoku.db');
