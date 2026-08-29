/**
 * The two probes the cluster calls forever (homelab contract §3).
 *
 * The distinction is the point: `/healthz` must answer while the database is
 * on fire, because a liveness failure restarts the pod and restarting will not
 * mount a volume that is missing; `/readyz` must go 503 in exactly that case,
 * because it is the signal that takes the pod out of the Service. So the
 * interesting test here is not the happy path — it is the closed handle.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeHarness, type Harness } from './testHarness.js';

let h: Harness;
beforeEach(async () => {
  h = await makeHarness();
});
afterEach(async () => {
  await h.close();
  vi.unstubAllEnvs();
});

describe('GET /healthz', () => {
  it('is 200 {status, version} and reports `dev` when APP_VERSION is unset', async () => {
    const res = await h.app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok', version: 'dev' });
  });

  it('reports APP_VERSION — the image tag is the only version a container has', async () => {
    vi.stubEnv('APP_VERSION', 'sha-0123456789abcdef');
    const versioned = await makeHarness();
    try {
      const res = await versioned.app.inject({ method: 'GET', url: '/healthz' });
      expect(res.json()).toEqual({ status: 'ok', version: 'sha-0123456789abcdef' });
    } finally {
      await versioned.close();
    }
  });

  it('answers without touching the database — a closed handle is still 200', async () => {
    h.db.close();
    const res = await h.app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok' });
  });
});

describe('GET /readyz', () => {
  it('is 200 {status:"ready"} once the migrations have run', async () => {
    const res = await h.app.inject({ method: 'GET', url: '/readyz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ready' });
  });

  it('is 503 with a reason, not a throw, when the handle is closed', async () => {
    h.db.close();
    const res = await h.app.inject({ method: 'GET', url: '/readyz' });
    expect(res.statusCode).toBe(503);
    const body = res.json<{ status: string; reason: string }>();
    expect(body.status).toBe('not-ready');
    expect(body.reason).toMatch(/database/i);
  });

  it('is 503 while the newest migration has not been recorded', async () => {
    h.db.prepare('DELETE FROM schema_migrations').run();
    const res = await h.app.inject({ method: 'GET', url: '/readyz' });
    expect(res.statusCode).toBe(503);
    expect(res.json<{ reason: string }>().reason).toMatch(/001_init\.sql/);
  });
});

describe('the probes are not API routes', () => {
  it('are outside /api and get no SPA fallback treatment', async () => {
    expect((await h.app.inject({ method: 'GET', url: '/api/healthz' })).statusCode).toBe(404);
    expect((await h.app.inject({ method: 'GET', url: '/api/readyz' })).statusCode).toBe(404);
  });
});
