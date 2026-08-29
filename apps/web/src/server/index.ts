/**
 * The Fastify app factory and the process entry point (decisions 6 and 7).
 *
 * One process, one port: the same server answers `/api/*` and serves the built
 * client as static files, so the container is one image and the home lab needs
 * one ingress. `buildApp` takes its database and its puzzle source as
 * arguments, which is what lets the tests run against a temp DB and fixture
 * puzzles while `generate()` is still a WP-D stub.
 *
 * Handover note for WP-G: production wiring is `corePuzzleSource` (already the
 * default in `main` when `SUDOKU_FIXTURE` is unset). The fixture hook is
 * dev/e2e-only and stays.
 */

import { existsSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import { LEVELS } from 'sudoku-core';
import { dataDir, openDb, type Db } from './db.js';
import { seedAwkwardGame } from './awkward.js';
import { corePuzzleSource, fixturePuzzleSource, type PuzzleSource } from './puzzleSource.js';
import { registerRoutes } from './routes.js';

export interface BuildAppOptions {
  db: Db;
  /** injected so wave 2 can test without WP-D's `generate` (plan's `{ generate }`) */
  puzzleSource?: PuzzleSource;
  /** built client to serve; `null`/missing directory = API only */
  clientDir?: string | null;
  logger?: boolean;
}

export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const { db, puzzleSource = corePuzzleSource, clientDir = null, logger = false } = options;
  const app = Fastify({ logger });

  // Own the JSON parsing so every 400 has our shape (`routes.ts` header) and so
  // an empty body on POST /api/game/complete — which takes none — is not a
  // parser error.
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_request, body, done) => {
    const text = typeof body === 'string' ? body.trim() : '';
    if (text === '') return done(null, {});
    try {
      done(null, JSON.parse(text) as unknown);
    } catch {
      const error = Object.assign(new Error('body is not valid JSON'), { statusCode: 400 });
      done(error, undefined);
    }
  });

  app.setErrorHandler((error: FastifyError, _request, reply) => {
    const status = error.statusCode ?? 500;
    if (status === 400)
      return reply.code(400).send({ error: 'bad-request', message: error.message });
    app.log.error(error);
    return reply.code(status >= 500 ? 500 : status).send({ error: 'internal-error' });
  });

  registerRoutes(app, { db, puzzleSource });

  const serveClient = clientDir !== null && existsSync(join(clientDir, 'index.html'));
  if (serveClient) {
    await app.register(fastifyStatic, { root: clientDir, index: ['index.html'] });
  }

  app.setNotFoundHandler((request, reply) => {
    // SPA fallback: a non-API GET for something that looks like a client route
    // gets index.html so the router can handle it. A request that looks like a
    // *file* (a last segment with an extension) does not — a missing bundle
    // should 404 rather than quietly return HTML with a 200, which is how a
    // broken asset path turns into an unreadable console error.
    const path = request.url.split('?')[0] ?? '/';
    const looksLikeFile = /\.[a-z0-9]+$/i.test(path.slice(path.lastIndexOf('/')));
    if (serveClient && request.method === 'GET' && !path.startsWith('/api/') && !looksLikeFile) {
      return reply.type('text/html').sendFile('index.html');
    }
    return reply.code(404).send({ error: 'not-found' });
  });

  return app;
}

/**
 * `dist/client`, wherever this module is running from: `src/server/index.ts`
 * under tsx in dev, or the bundled `dist/server/index.js`. `CLIENT_DIR`
 * overrides. Returns the directory even if it does not exist — the caller logs
 * and carries on, because the API must boot before WP-F's build exists.
 */
export function clientDirCandidate(env: NodeJS.ProcessEnv = process.env): string {
  if (env.CLIENT_DIR && env.CLIENT_DIR.length > 0) return env.CLIENT_DIR;
  const here = fileURLToPath(new URL('.', import.meta.url));
  // `../../dist/client` resolves to apps/web/dist/client from BOTH src/server
  // (dev) and dist/server (built), so it leads; `../client` is the built-only
  // shorthand and doubles as the message when nothing is there yet.
  const candidates = [join(here, '..', '..', 'dist', 'client'), join(here, '..', 'client')];
  return candidates.find((dir) => existsSync(join(dir, 'index.html'))) ?? (candidates[0] as string);
}

/**
 * Dev/e2e only. `SUDOKU_FIXTURE=<level>` swaps the core generator for the six
 * committed sudokuoftheday.com fixtures (the requested level gets its own), and
 * `SUDOKU_FIXTURE=awkward` does that *and* seeds the awkward board (see
 * `awkward.ts`) as the active game when none is active. Unset = the real
 * generator.
 */
export function fixtureModeFrom(env: NodeJS.ProcessEnv = process.env): 'off' | 'level' | 'awkward' {
  const value = env.SUDOKU_FIXTURE;
  if (!value) return 'off';
  if (value === 'awkward') return 'awkward';
  if ((LEVELS as readonly string[]).includes(value)) return 'level';
  throw new Error(
    `SUDOKU_FIXTURE must be 'awkward' or one of: ${LEVELS.join(', ')} — got '${value}'`,
  );
}

export async function main(): Promise<FastifyInstance> {
  const dir = dataDir();
  const db = openDb(dir);
  const mode = fixtureModeFrom();
  const puzzleSource = mode === 'off' ? corePuzzleSource : fixturePuzzleSource;

  const clientDir = clientDirCandidate();
  const app = await buildApp({ db, puzzleSource, clientDir, logger: true });

  if (mode !== 'off') {
    app.log.warn(`SUDOKU_FIXTURE=${process.env.SUDOKU_FIXTURE} — serving committed fixtures`);
  }
  if (mode === 'awkward') {
    app.log.warn(seedAwkwardGame(db) ? 'seeded the awkward game' : 'a game is already active');
  }
  if (!existsSync(join(clientDir, 'index.html'))) {
    app.log.warn(`no built client at ${clientDir} — serving the API only`);
  }

  const port = Number(process.env.PORT ?? 8080);
  const host = process.env.HOST ?? '0.0.0.0';
  await app.listen({ port, host });
  app.log.info(`data dir ${dir}`);
  return app;
}

/**
 * True when this module is the process entry point — `tsx src/server/index.ts`
 * in dev, `node dist/server/index.js` in the container — and false when a test
 * imports `buildApp` from it, which must not start a listener.
 */
function isEntryPoint(): boolean {
  const entry = process.argv[1];
  if (entry === undefined) return false;
  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(resolve(entry));
  } catch {
    return false;
  }
}

if (isEntryPoint()) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
