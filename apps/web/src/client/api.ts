/**
 * Typed fetch wrappers over the frozen contract (`src/shared/api.ts`).
 *
 * Every status the contract names is a *value*, not an exception: 204 is
 * `null`, 409 is a tagged result, 404 is a tagged result. Only statuses the
 * contract does not name — and transport failures — throw, because those are
 * the ones a caller cannot sensibly branch on and the save loop must retry.
 * That split is what lets `useGame` retry a dropped save without also retrying
 * a "you got a cell wrong".
 */

import {
  API_ROUTES,
  type ActiveGame,
  type CreateGameBody,
  type HistoryEntry,
  type Level,
  type SaveProgressBody,
} from '../shared/api';

/** A response the contract does not describe. Always worth retrying or showing. */
export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, route: string) {
    super(`${route} responded ${status}`);
    this.name = 'HttpError';
    this.status = status;
  }
}

async function parseJson<T>(res: Response, route: string): Promise<T> {
  try {
    return (await res.json()) as T;
  } catch {
    throw new HttpError(res.status, `${route} (unparseable body)`);
  }
}

/** GET /api/game — `null` when the server says 204, i.e. no active game. */
export async function fetchActiveGame(signal?: AbortSignal): Promise<ActiveGame | null> {
  const res = await fetch(API_ROUTES.game, { signal: signal ?? null });
  if (res.status === 204) return null;
  if (res.status === 200) return parseJson<ActiveGame>(res, API_ROUTES.game);
  throw new HttpError(res.status, API_ROUTES.game);
}

export type CreateGameResult =
  { ok: true; game: ActiveGame } | { ok: false; error: 'active-game-exists' };

/** POST /api/game — 409 is a normal outcome (decision 8), not an error. */
export async function createGame(level: Level): Promise<CreateGameResult> {
  const body: CreateGameBody = { level };
  const res = await fetch(API_ROUTES.game, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.status === 201)
    return { ok: true, game: await parseJson<ActiveGame>(res, 'POST /api/game') };
  if (res.status === 409) return { ok: false, error: 'active-game-exists' };
  throw new HttpError(res.status, `POST ${API_ROUTES.game}`);
}

export type SaveResult = { ok: true; game: ActiveGame } | { ok: false; error: 'no-active-game' };

/**
 * PUT /api/game/progress — the whole-state save of decision 11.
 *
 * `keepalive` is what makes the `pagehide` save survive the page going away;
 * it is not set on ordinary debounced saves because keepalive requests have a
 * small body budget and no such guarantee is needed while the page is alive.
 */
export async function saveProgress(
  body: SaveProgressBody,
  opts: { keepalive?: boolean } = {},
): Promise<SaveResult> {
  const res = await fetch(API_ROUTES.progress, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    keepalive: opts.keepalive === true,
  });
  if (res.status === 200)
    return { ok: true, game: await parseJson<ActiveGame>(res, 'PUT /api/game/progress') };
  if (res.status === 404) return { ok: false, error: 'no-active-game' };
  throw new HttpError(res.status, `PUT ${API_ROUTES.progress}`);
}

export type CompleteResult =
  | { ok: true; entry: HistoryEntry }
  | { ok: false; error: 'not-solved'; wrongCells: number[] }
  | { ok: false; error: 'no-active-game' };

/**
 * POST /api/game/complete — the server owns the verdict (decision 10). A 409
 * carries the indices that do not match the stored solution.
 */
export async function completeGame(): Promise<CompleteResult> {
  const res = await fetch(API_ROUTES.complete, { method: 'POST' });
  if (res.status === 200) {
    return { ok: true, entry: await parseJson<HistoryEntry>(res, 'POST /api/game/complete') };
  }
  if (res.status === 409) {
    const body = await parseJson<{ error: string; wrongCells?: number[] }>(
      res,
      'POST /api/game/complete',
    );
    return { ok: false, error: 'not-solved', wrongCells: body.wrongCells ?? [] };
  }
  if (res.status === 404) return { ok: false, error: 'no-active-game' };
  throw new HttpError(res.status, `POST ${API_ROUTES.complete}`);
}

/** GET /api/history — newest `completedAt` first, per the contract. */
export async function fetchHistory(signal?: AbortSignal): Promise<HistoryEntry[]> {
  const res = await fetch(API_ROUTES.history, { signal: signal ?? null });
  if (res.status === 200) return parseJson<HistoryEntry[]>(res, API_ROUTES.history);
  throw new HttpError(res.status, API_ROUTES.history);
}
