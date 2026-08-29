/**
 * `/healthz` and `/readyz` — the home lab's two probes (contract §3).
 *
 * They are deliberately *different*. `/healthz` is liveness: the answer to a
 * failure is "restart the process", so it must not depend on anything a
 * restart cannot fix — it touches no database and takes no lock. `/readyz` is
 * readiness: the answer to a failure is "stop sending it traffic", which is
 * exactly the right response to an unmounted volume or a schema that is still
 * being migrated, so it asks the open handle a question and reports what it
 * hears. A probe that throws is a 500 from Fastify's error handler and reads
 * as a broken app rather than an unready one, so every path here is caught.
 *
 * Both live outside `/api/*`: they are not part of the frozen client contract
 * (`shared/api.ts`) and no client ever calls them. They run every 10-20 s for
 * the life of the deployment, so both are two integer queries at most.
 */

import { readdirSync } from 'node:fs';
import type { FastifyInstance } from 'fastify';
import { migrationsDir, type Db } from './db.js';

export const HEALTH_ROUTES = { healthz: '/healthz', readyz: '/readyz' } as const;

/**
 * The version `/healthz` reports.
 *
 * From the environment and **not** from any `package.json`: every package in
 * this workspace says `0.0.0`, and the image tag is the only version a
 * container really has. The manifest sets `APP_VERSION` to the tag it deployed.
 */
export function appVersion(env: NodeJS.ProcessEnv = process.env): string {
  return env.APP_VERSION && env.APP_VERSION.length > 0 ? env.APP_VERSION : 'dev';
}

/**
 * The newest `.sql` file on disk — the migration that must be recorded before
 * this process is allowed to serve traffic. Read once, at registration: the
 * files are baked into the image and cannot change while it runs, and a probe
 * has no business hitting the filesystem twenty times a minute.
 *
 * `null` means the directory could not be read, which is not a state a booted
 * server reaches (`openDb` migrates first and would have thrown), but it is a
 * state this function must have an answer for, and "not ready" is that answer.
 */
export function latestMigration(): string | null {
  try {
    const files = readdirSync(migrationsDir())
      .filter((name) => name.endsWith('.sql'))
      .sort();
    return files.at(-1) ?? null;
  } catch {
    return null;
  }
}

export type Readiness = { ready: true } | { ready: false; reason: string };

/**
 * Ready = the handle answers *and* the schema is current.
 *
 * `SELECT count(*) FROM schema_migrations` is the cheapest question that
 * proves the whole chain at once: the volume is mounted, the file is openable,
 * and `migrate()` has at least created its bookkeeping table. The second query
 * is §7's half of the bargain — this app migrates at boot rather than in a
 * separate job, and the deal that makes that acceptable is that readiness
 * stays false until the newest migration has actually landed.
 */
export function readiness(db: Db, required: string | null): Readiness {
  if (required === null) return { ready: false, reason: 'no migrations directory could be read' };
  try {
    const counted = db.prepare('SELECT count(*) AS n FROM schema_migrations').get() as {
      n: number;
    };
    const applied = db
      .prepare('SELECT 1 AS ok FROM schema_migrations WHERE name = ?')
      .get(required);
    if (!applied) {
      return { ready: false, reason: `migration ${required} not applied (${counted.n} recorded)` };
    }
    return { ready: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ready: false, reason: `database unavailable: ${message}` };
  }
}

export interface HealthDeps {
  db: Db;
  /** overridable so a test can pin one; otherwise the environment, read once */
  version?: string;
  /** overridable so a test can pin one; `undefined` reads the migrations directory */
  requiredMigration?: string | null;
}

export function registerHealth(app: FastifyInstance, deps: HealthDeps): void {
  const version = deps.version ?? appVersion();
  const required =
    deps.requiredMigration === undefined ? latestMigration() : deps.requiredMigration;

  app.get(HEALTH_ROUTES.healthz, (_request, reply) =>
    reply.code(200).send({ status: 'ok', version }),
  );

  app.get(HEALTH_ROUTES.readyz, (_request, reply) => {
    const state = readiness(deps.db, required);
    if (state.ready) return reply.code(200).send({ status: 'ready' });
    return reply.code(503).send({ status: 'not-ready', reason: state.reason });
  });
}
