import { defineConfig } from 'vitest/config';

// One `pnpm test` at the repo root runs every workspace package. Each project is
// named, so a failure summary says which package it came from and
// `pnpm vitest run --project sudoku-core` narrows the run.
//
// This is `test.projects` and not the old `vitest.workspace.ts`: the workspace
// file was deprecated in Vitest 3 and removed in 4. The three project names are
// a contract — scripts, CI and ORCHESTRATION.md all name them — so they, their
// includes and their environments are unchanged by the move.
//
//   - `sudoku-core` — the pure library, node environment.
//   - `web` — the server tests, node environment.
//   - `web-client` — the client/component tests, which need a DOM (jsdom).
export default defineConfig({
  test: {
    projects: [
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
          // Kept from the scaffold: `web` owns the server tests only, and an
          // empty run here should not be the thing that fails the gate.
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
    ],
  },
});
