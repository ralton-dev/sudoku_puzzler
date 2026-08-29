import { defineWorkspace } from 'vitest/config';

// One `pnpm test` at the repo root runs every workspace package. Each project is
// named, so a failure summary says which package it came from and
// `pnpm vitest run --project sudoku-core` narrows the run.
//
// Wave-2 notes:
//   - WP-E's server tests are `apps/web/src/server/**/*.test.ts` and land in the
//     existing `web` project below; nothing here needs changing.
//   - WP-F's client/component tests need a DOM. Add a third project
//     (name: 'web-client', environment: 'jsdom', include:
//     ['src/client/**/*.test.tsx']) and narrow `web`'s include to src/server —
//     that is the only edit this file is expected to take.
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
      include: ['src/**/*.test.ts'],
      // apps/web is a contract-only skeleton until wave 2 (WP-E/WP-F). Without
      // this the whole run fails on an empty project rather than on a real test.
      passWithNoTests: true,
    },
  },
]);
