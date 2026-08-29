/**
 * Test-only: a throwaway DB and an app wired to the committed fixtures.
 *
 * A real file on disk in a temp dir rather than `:memory:`, on purpose — it is
 * the same code path as production, including WAL and the migration runner
 * reading `.sql` files off disk, so a broken migration path fails in the tests
 * and not first on the home lab.
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { CellState, Digit } from '../shared/api.js';
import { openDb, type Db } from './db.js';
import { buildApp } from './index.js';
import { fixturePuzzleSource, type PuzzleSource } from './puzzleSource.js';

export interface Harness {
  app: FastifyInstance;
  db: Db;
  dir: string;
  close(): Promise<void>;
}

export async function makeHarness(
  puzzleSource: PuzzleSource = fixturePuzzleSource,
): Promise<Harness> {
  const dir = mkdtempSync(join(tmpdir(), 'sudoku-wpe-'));
  const db = openDb(dir);
  const app = await buildApp({ db, puzzleSource });
  return {
    app,
    db,
    dir,
    async close() {
      await app.close();
      db.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

/** An 81-char grid string as a filled-in board. */
export function cellsFrom(grid: string): CellState[] {
  return Array.from(grid, (char) => ({ value: (char.charCodeAt(0) - 48) as Digit, marks: [] }));
}
