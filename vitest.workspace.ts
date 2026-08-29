import { defineWorkspace } from 'vitest/config';

// One `pnpm test` at the repo root runs every workspace package. Each project is
// named, so a failure summary says which package it came from and
// `pnpm vitest run --project sudoku-core` narrows the run.
//
// Wave-2 notes:
//   - WP-E's server tests are `apps/web/src/server/**/*.test.ts` and land in the
//     existing `web` project below.
//   - WP-F's client/component tests need a DOM, so they are their own project
//     (`web-client`, jsdom) and `web` is narrowed to src/server. That split was
//     the edit this file was written expecting; it has now been made.
export default defineWorkspace([
  {
    test: {
      name: 'sudoku-core',
      root: './packages/sudoku-core',
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  },
  {
    test: {
      name: 'web',
      root: './apps/web',
      environment: 'node',
      include: ['src/server/**/*.test.ts'],
      // apps/web is a contract-only skeleton until wave 2 (WP-E/WP-F). Without
      // this the whole run fails on an empty project rather than on a real test.
      passWithNoTests: true,
    },
  },
  {
    test: {
      name: 'web-client',
      root: './apps/web',
      environment: 'jsdom',
      include: ['src/client/**/*.test.ts', 'src/client/**/*.test.tsx'],
      setupFiles: ['./src/client/test-setup.ts'],
    },
  },
]);
