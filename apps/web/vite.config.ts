import { defineConfig, type ProxyOptions } from 'vite';
import react from '@vitejs/plugin-react';
import { mockApiPlugin, type MockFixture } from './src/client/dev/mockApi';

/**
 * The client build. Root is `apps/web` (so `index.html` sits next to this
 * file); output is `apps/web/dist/client`, which is exactly what WP-E's
 * `@fastify/static` serves in production — one process, one port (decision 7).
 *
 * Dev has two modes:
 *   - default: `/api` is proxied to the Fastify server. `API_PROXY_TARGET`
 *     overrides the target so a locally booted server on another port can be
 *     pointed at without editing this file.
 *   - `VITE_MOCK_API=1`: an in-memory stand-in for the five routes is mounted
 *     inside the dev server instead (see `src/client/dev/mockApi.ts`). This
 *     exists so the client can be driven in a real browser without the server;
 *     it is never part of a build.
 */
export default defineConfig(() => {
  const useMock = process.env.VITE_MOCK_API === '1';
  const fixture = (process.env.VITE_MOCK_FIXTURE ?? 'awkward') as MockFixture;
  const target = process.env.API_PROXY_TARGET ?? 'http://localhost:8080';
  const proxy: Record<string, ProxyOptions> = useMock
    ? {}
    : { '/api': { target, changeOrigin: false } };

  return {
    plugins: [react(), ...(useMock ? [mockApiPlugin(fixture)] : [])],
    build: {
      outDir: 'dist/client',
      emptyOutDir: true,
    },
    server: {
      port: Number(process.env.VITE_PORT ?? 5173),
      strictPort: true,
      proxy,
    },
    preview: {
      port: Number(process.env.VITE_PORT ?? 5173),
    },
  };
});
