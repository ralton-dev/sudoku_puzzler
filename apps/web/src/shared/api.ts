/**
 * THE FROZEN HTTP CONTRACT (decision 12).
 *
 * WP-A wrote this in wave 1 so WP-E (server) and WP-F (client) can build
 * against it concurrently without meeting. It is a choke-point file: after wave
 * 1, a change here is *routed* to both packages' briefs explicitly — it is not
 * made unilaterally by whichever package noticed first. If you are in WP-E or
 * WP-F and this type is wrong for you, say so in your report and stop; do not
 * edit it.
 *
 * Types only, plus one route table. No runtime behaviour, no imports from the
 * server or the client, so both sides can import it freely.
 *
 * Shape reminders that the types alone do not carry:
 *   - `givens` is 81 chars, row-major, '0' for an empty cell.
 *   - `cells` is always length 81 and always present, even on a brand-new game;
 *     a given's cell carries its digit as `value` with empty `marks`.
 *   - times are ISO-8601 UTC strings.
 *   - `elapsedMs` is client-measured and informational (decision 9). The server
 *     stores the latest value it is sent and copies it into history on
 *     completion; it never reconciles it against its own clock.
 *   - there is deliberately NO abandon/delete endpoint (decision 8).
 */

import type { Level } from 'sudoku-core';

export type { Level };

/** A cell's entered digit. 0 means empty. */
export type Digit = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

/** One cell of the user's board state: their digit, and their pencil marks. */
export interface CellState {
  value: Digit;
  /** pencil-mark digits, 1..9, no duplicates; order is not significant */
  marks: number[];
}

/** The single active game (decision 8: there is at most one). */
export interface ActiveGame {
  id: string;
  level: Level;
  /** 81 chars, '0' = empty */
  givens: string;
  /** always length 81 */
  cells: CellState[];
  elapsedMs: number;
  /** ISO-8601 UTC */
  startedAt: string;
}

/** A completed game, as it appears in history. */
export interface HistoryEntry {
  id: string;
  level: Level;
  /** ISO-8601 UTC */
  startedAt: string;
  /** ISO-8601 UTC */
  completedAt: string;
  elapsedMs: number;
  /** 81 chars, '0' = empty — kept so history can show the clue count */
  givens: string;
}

// --- request bodies ------------------------------------------------------

/** POST /api/game */
export interface CreateGameBody {
  level: Level;
}

/** PUT /api/game/progress — whole-state save, never a per-cell patch (decision 11). */
export interface SaveProgressBody {
  /** always length 81 */
  cells: CellState[];
  elapsedMs: number;
}

// --- error bodies --------------------------------------------------------

/** 409 from POST /api/game — one active game already exists (decision 8). */
export interface ActiveGameExistsError {
  error: 'active-game-exists';
}

/**
 * 409 from POST /api/game/complete — the server compared the saved cells with
 * the stored solution and they differ (decision 10). `wrongCells` are the 0..80
 * indices that do not match.
 */
export interface NotSolvedError {
  error: 'not-solved';
  wrongCells: number[];
}

export type ApiError = ActiveGameExistsError | NotSolvedError;

// --- routes --------------------------------------------------------------

/**
 * The five routes, and nothing else under /api.
 *
 *   GET  /api/game             200 ActiveGame | 204 (no active game)
 *   POST /api/game             201 ActiveGame | 409 ActiveGameExistsError
 *        body CreateGameBody
 *   PUT  /api/game/progress    200 ActiveGame | 404 (no active game)
 *        body SaveProgressBody
 *   POST /api/game/complete    200 HistoryEntry | 409 NotSolvedError | 404
 *   GET  /api/history          200 HistoryEntry[] (newest completedAt first)
 */
export const API_ROUTES = {
  game: '/api/game',
  progress: '/api/game/progress',
  complete: '/api/game/complete',
  history: '/api/history',
} as const;

export type ApiRoute = (typeof API_ROUTES)[keyof typeof API_ROUTES];
