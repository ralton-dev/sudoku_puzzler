/**
 * A dev-only, in-memory stand-in for the five routes of the frozen contract
 * (`src/shared/api.ts`).
 *
 * WP-F was built concurrently with WP-E's real Fastify server, so the client
 * needed something to talk to in a real browser before that server existed.
 * This plugin is that something and nothing more: it is wired into
 * `vite.config.ts` **only** when `VITE_MOCK_API=1`, it never ships in a build,
 * and it is not a second implementation of the contract to be kept in step —
 * when the real server is up, run Vite without the flag and the `/api` proxy
 * takes over.
 *
 * It is seeded with the *awkward* fixture the plan asks for ("The fixture shape"
 * and "the regression to fear"): the board the browser first sees is one cell
 * from complete, has a wrong digit in it, carries six pencil marks in one box
 * and an elapsed time past an hour. The whole point is that the app is never
 * developed against an empty board.
 *
 * The givens/solution are the real `easy` puzzle from sudoku-core's fixtures,
 * imported rather than copied so this cannot drift from the oracle. The core
 * package only exports its root, so the fixture is reached by path; that is
 * acceptable here because this file is dev tooling, not shipped client code.
 */

import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { KNOWN_BY_LEVEL } from '../../../../../packages/sudoku-core/src/fixtures/known';
import type {
  ActiveGame,
  CellState,
  CreateGameBody,
  Digit,
  HistoryEntry,
  Level,
  SaveProgressBody,
} from '../../shared/api';

/** Which seeded state the mock starts in. `VITE_MOCK_FIXTURE` picks it. */
export type MockFixture = 'awkward' | 'easy' | 'none';

interface MockGame {
  game: ActiveGame;
  solution: string;
}

const HOUR_PLUS = 3_723_456; // 1h 02m 03.456s — the timer is past an hour

function emptyCells(givens: string): CellState[] {
  return Array.from({ length: 81 }, (_, i) => ({
    value: (givens[i] === '0' ? 0 : Number(givens[i])) as Digit,
    marks: [],
  }));
}

function newGame(level: Level, id: string): MockGame {
  const known = KNOWN_BY_LEVEL[level];
  return {
    game: {
      id,
      level,
      givens: known.givens,
      cells: emptyCells(known.givens),
      elapsedMs: 0,
      startedAt: new Date().toISOString(),
    },
    solution: known.solution,
  };
}

/**
 * The awkward fixture, built from the `easy` puzzle:
 *   - every non-given cell filled from the solution, except one left empty;
 *   - one other non-given cell holding a digit that is wrong;
 *   - six pencil marks spread over three cells of the empty cell's box, the way
 *     a real player leaves them behind after filling cells around a mark;
 *   - `elapsedMs` past an hour.
 */
function awkwardGame(id: string): MockGame {
  const known = KNOWN_BY_LEVEL.easy;
  const { givens, solution } = known;
  const cells: CellState[] = Array.from({ length: 81 }, (_, i) => ({
    value: Number(solution[i]) as Digit,
    marks: [],
  }));

  const nonGiven = (i: number): boolean => givens[i] === '0';
  const boxOf = (i: number): number => Math.floor(i / 27) * 3 + Math.floor((i % 9) / 3);

  // The empty cell: the first non-given cell of the centre box.
  const emptyIdx = [...Array(81).keys()].find((i) => boxOf(i) === 4 && nonGiven(i));
  if (emptyIdx === undefined) throw new Error('mock fixture: centre box is entirely given');

  // The wrong digit: the first non-given cell outside that box.
  const wrongIdx = [...Array(81).keys()].find((i) => nonGiven(i) && boxOf(i) !== boxOf(emptyIdx));
  if (wrongIdx === undefined) throw new Error('mock fixture: no cell to spoil');

  const emptyCell = cells[emptyIdx];
  const wrongCell = cells[wrongIdx];
  if (!emptyCell || !wrongCell) throw new Error('mock fixture: index out of range');

  emptyCell.value = 0;
  const truth = Number(solution[emptyIdx]);
  // Always three distinct marks, one of which is the right answer.
  emptyCell.marks = [truth, ...[1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => d !== truth)].slice(0, 3);

  const wrongDigit = ((Number(solution[wrongIdx]) % 9) + 1) as Digit;
  wrongCell.value = wrongDigit;

  // Leftover marks on two more cells of the same box, so the box carries six.
  const boxMates = [...Array(81).keys()].filter(
    (i) => boxOf(i) === boxOf(emptyIdx) && i !== emptyIdx && nonGiven(i),
  );
  const leftovers = [
    [2, 6],
    [3],
  ];
  boxMates.slice(0, leftovers.length).forEach((idx, n) => {
    const cell = cells[idx];
    const marks = leftovers[n];
    if (cell && marks) cell.marks = marks;
  });

  return {
    game: {
      id,
      level: 'easy',
      givens,
      cells,
      elapsedMs: HOUR_PLUS,
      startedAt: new Date(Date.now() - HOUR_PLUS).toISOString(),
    },
    solution,
  };
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += String(chunk);
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function send(res: ServerResponse, status: number, body?: unknown): void {
  if (body === undefined) {
    res.statusCode = status;
    res.end();
    return;
  }
  const json = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(json);
}

/**
 * The Vite plugin. Only added to the config when `VITE_MOCK_API=1`; the state
 * lives in the dev-server process, so a browser reload finds exactly what the
 * previous page saved — which is the point of the reload proof.
 */
export function mockApiPlugin(fixture: MockFixture = 'awkward'): Plugin {
  let nextId = 1;
  let active: MockGame | null =
    fixture === 'awkward'
      ? awkwardGame(`mock-${nextId++}`)
      : fixture === 'easy'
        ? newGame('easy', `mock-${nextId++}`)
        : null;
  const history: HistoryEntry[] = [];

  return {
    name: 'sudoku-mock-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? '').split('?')[0] ?? '';
        if (!url.startsWith('/api/')) {
          next();
          return;
        }
        const method = req.method ?? 'GET';

        void (async () => {
          if (url === '/api/game' && method === 'GET') {
            if (!active) return send(res, 204);
            return send(res, 200, active.game);
          }

          if (url === '/api/game' && method === 'POST') {
            if (active) return send(res, 409, { error: 'active-game-exists' });
            const body = JSON.parse((await readBody(req)) || '{}') as CreateGameBody;
            active = newGame(body.level, `mock-${nextId++}`);
            return send(res, 201, active.game);
          }

          if (url === '/api/game/progress' && method === 'PUT') {
            if (!active) return send(res, 404, { error: 'no-active-game' });
            const body = JSON.parse((await readBody(req)) || '{}') as SaveProgressBody;
            active.game = { ...active.game, cells: body.cells, elapsedMs: body.elapsedMs };
            return send(res, 200, active.game);
          }

          if (url === '/api/game/complete' && method === 'POST') {
            if (!active) return send(res, 404, { error: 'no-active-game' });
            const { game, solution } = active;
            const wrongCells = game.cells
              .map((c, i) => (String(c.value) === solution[i] ? -1 : i))
              .filter((i) => i >= 0);
            if (wrongCells.length > 0) return send(res, 409, { error: 'not-solved', wrongCells });
            const entry: HistoryEntry = {
              id: game.id,
              level: game.level,
              startedAt: game.startedAt,
              completedAt: new Date().toISOString(),
              elapsedMs: game.elapsedMs,
              givens: game.givens,
            };
            history.unshift(entry);
            active = null;
            return send(res, 200, entry);
          }

          if (url === '/api/history' && method === 'GET') {
            return send(res, 200, history);
          }

          return send(res, 404, { error: 'not-found' });
        })().catch((err: unknown) => {
          send(res, 500, { error: String(err) });
        });
      });
    },
  };
}
