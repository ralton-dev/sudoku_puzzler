/**
 * The five routes of the frozen contract (`src/shared/api.ts`) and nothing
 * else under /api. Status codes and bodies are that file's, not this one's.
 *
 * Request-body validation is ours to choose — the contract does not specify a
 * 400 — and the shape is `{ error: 'bad-request', message }` with a message
 * that names the offending field. It is deliberately *not* one of `ApiError`'s
 * members: a 400 means the client sent something the contract does not
 * describe, which is a client bug, whereas `active-game-exists` and
 * `not-solved` are contracted outcomes the client is expected to handle.
 */

import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { LEVELS, type Level } from 'sudoku-core';
import { API_ROUTES, type CellState, type Digit } from '../shared/api.js';
import type { Db } from './db.js';
import type { PuzzleSource } from './puzzleSource.js';
import {
  initialCells,
  insertGame,
  markCompleted,
  saveProgress,
  selectActive,
  selectHistory,
  toActiveGame,
  toHistoryEntry,
  wrongCells,
} from './games.js';

export interface RouteDeps {
  db: Db;
  puzzleSource: PuzzleSource;
}

/** The 400 body. Not part of `ApiError` — see the file header. */
export interface BadRequestError {
  error: 'bad-request';
  message: string;
}

const badRequest = (message: string): BadRequestError => ({ error: 'bad-request', message });

type Validated<T> = { ok: true; value: T } | { ok: false; message: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function validateCreateGame(body: unknown): Validated<Level> {
  if (!isRecord(body)) return { ok: false, message: 'body must be a JSON object' };
  const level = body.level;
  if (typeof level !== 'string' || !(LEVELS as readonly string[]).includes(level)) {
    return { ok: false, message: `level must be one of: ${LEVELS.join(', ')}` };
  }
  return { ok: true, value: level as Level };
}

/**
 * Marks are normalised, not rejected, when they repeat: the contract says "no
 * duplicates" of the value, and a client that sends `[3, 3]` means the mark 3
 * is set. Sorting makes a saved board compare equal to itself after a reload.
 */
function validateCells(raw: unknown): Validated<CellState[]> {
  if (!Array.isArray(raw)) return { ok: false, message: 'cells must be an array' };
  if (raw.length !== 81) {
    return { ok: false, message: `cells must have exactly 81 entries, got ${raw.length}` };
  }
  const cells: CellState[] = [];
  for (let i = 0; i < 81; i += 1) {
    const cell: unknown = raw[i];
    if (!isRecord(cell)) return { ok: false, message: `cells[${i}] must be an object` };
    const { value, marks } = cell;
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 9) {
      return { ok: false, message: `cells[${i}].value must be an integer 0..9` };
    }
    if (!Array.isArray(marks)) {
      return { ok: false, message: `cells[${i}].marks must be an array` };
    }
    for (const mark of marks) {
      if (typeof mark !== 'number' || !Number.isInteger(mark) || mark < 1 || mark > 9) {
        return { ok: false, message: `cells[${i}].marks must be integers 1..9` };
      }
    }
    cells.push({
      value: value as Digit,
      marks: [...new Set(marks as number[])].sort((a, b) => a - b),
    });
  }
  return { ok: true, value: cells };
}

function validateProgress(body: unknown): Validated<{ cells: CellState[]; elapsedMs: number }> {
  if (!isRecord(body)) return { ok: false, message: 'body must be a JSON object' };
  const cells = validateCells(body.cells);
  if (!cells.ok) return cells;
  const elapsed = body.elapsedMs;
  if (typeof elapsed !== 'number' || !Number.isFinite(elapsed) || elapsed < 0) {
    return { ok: false, message: 'elapsedMs must be a finite number >= 0' };
  }
  return { ok: true, value: { cells: cells.value, elapsedMs: Math.round(elapsed) } };
}

export function registerRoutes(app: FastifyInstance, deps: RouteDeps): void {
  const { db, puzzleSource } = deps;

  // GET /api/game — 200 ActiveGame | 204
  app.get(API_ROUTES.game, (_request, reply) => {
    const row = selectActive(db);
    if (!row) return reply.code(204).send();
    return reply.code(200).send(toActiveGame(row));
  });

  // POST /api/game — 201 ActiveGame | 409 active-game-exists | 400
  app.post(API_ROUTES.game, (request, reply) => {
    const parsed = validateCreateGame(request.body);
    if (!parsed.ok) return reply.code(400).send(badRequest(parsed.message));
    if (selectActive(db)) return reply.code(409).send({ error: 'active-game-exists' });

    const puzzle = puzzleSource.generate(parsed.value);
    try {
      const row = insertGame(db, {
        id: randomUUID(),
        level: puzzle.level,
        givens: puzzle.givens,
        solution: puzzle.solution,
        seed: puzzle.seed,
        cells: initialCells(puzzle.givens),
        elapsedMs: 0,
        startedAt: new Date().toISOString(),
      });
      return reply.code(201).send(toActiveGame(row));
    } catch (error) {
      // The partial unique index is the truth, the SELECT above is only the
      // fast path: two concurrent POSTs both pass it and one loses here.
      if (isUniqueViolation(error)) {
        return reply.code(409).send({ error: 'active-game-exists' });
      }
      throw error;
    }
  });

  // PUT /api/game/progress — 200 ActiveGame | 404 | 400
  app.put(API_ROUTES.progress, (request, reply) => {
    const parsed = validateProgress(request.body);
    if (!parsed.ok) return reply.code(400).send(badRequest(parsed.message));
    const row = selectActive(db);
    if (!row) return reply.code(404).send({ error: 'no-active-game' });
    const saved = saveProgress(db, row.id, parsed.value.cells, parsed.value.elapsedMs);
    return reply.code(200).send(toActiveGame(saved));
  });

  // POST /api/game/complete — 200 HistoryEntry | 409 not-solved | 404
  app.post(API_ROUTES.complete, (_request, reply) => {
    const row = selectActive(db);
    if (!row) return reply.code(404).send({ error: 'no-active-game' });
    const cells = JSON.parse(row.cells_json) as CellState[];
    const wrong = wrongCells(cells, row.solution);
    if (wrong.length > 0) {
      return reply.code(409).send({ error: 'not-solved', wrongCells: wrong });
    }
    const completed = markCompleted(db, row.id, new Date().toISOString());
    return reply.code(200).send(toHistoryEntry(completed));
  });

  // GET /api/history — 200 HistoryEntry[]
  app.get(API_ROUTES.history, (_request, reply) =>
    reply.code(200).send(selectHistory(db).map(toHistoryEntry)),
  );
}

export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string' &&
    (error as { code: string }).code.startsWith('SQLITE_CONSTRAINT')
  );
}
