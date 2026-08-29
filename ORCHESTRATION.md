# Orchestration

Written by WP-A. Read `PLAN-sudoku-puzzler.md` first — it is the spec. This file
is the operating manual: what the gate is, how to boot the thing, what the rules
are, which files may not be co-owned, and who has landed.

Decisions are referenced by number throughout (`decision 8`), never restated. If
this file and the plan disagree, the plan wins and this file is the bug.

## The gate

```
pnpm check
```

`check` = `lint` → `typecheck` → `test` → `build`, in that order, and stops at the
first failure. There is one gate; no package has its own. It is what CI runs and
it is what "green" means everywhere in this repo.

- `lint` — `eslint .` then `prettier --check .` over the whole tree. Prettier is
  fatal and repo-wide, so a half-written file anywhere breaks the gate for
  everyone. `pnpm format` fixes formatting.
- `typecheck` — `tsc --noEmit` per workspace package.
- `test` — one `vitest run` at the root across named projects (see below).
- `build` — `pnpm -r --if-present build`. Today only `sudoku-core` has one.

Run it before you commit, and again before you report. Don't run it more than
twice in a row without changing something.

## Boot

```
pnpm --filter web dev
```

Not wired yet — WP-E lands the Fastify server, WP-F the Vite client and the dev
script. Until then there is nothing to boot. Once it exists: one process, one
port (`PORT`, default 8080), SQLite under `DATA_DIR` (default `./data`),
decisions 6 and 7. `curl localhost:8080/api/game` → 204 on a fresh `DATA_DIR`.

## Rules for every package

- **Commits** — decision 14: conventional commits with a scope
  (`feat(core): …`, `feat(web): …`, `chore(repo): …`, `ci(repo): …`,
  `docs(repo): …`), **no `Co-Authored-By` trailers**, commit direct to `main`.
- **Staging** — stage the paths you own, **by name**. Never `git add -A`, never
  `git add .`, never `git stash`, `git restore`, or `git checkout --`. Another
  agent's unstaged work is in the same tree; those commands eat it.
- **Deletion** — decision 13: a package that replaces a stub or an earlier
  implementation deletes it **in the same commit** and reports per symbol —
  deleted, or kept and who still calls it.
- **Don't patch outside your `Owns`.** If your change makes something outside
  your files incoherent, say so in your report and leave it.
- **Report drift.** `file:line` references in the plan are hints to verify. Grep
  for the symbol, confirm it says what the plan claims, and report the difference
  rather than working around it. If a premise is wrong, serve its intent and say
  so.
- **Emit output between steps.** Commit before any long final verification.
  Browser checks happen first, not last.

Only WP-A pushed. Later waves commit; the orchestrator pushes and watches CI.

## Choke-point files — never co-owned

One owner per wave, named in that wave's brief. If you need a change in one of
these and you don't own it this wave, **stop and report it** — the orchestrator
routes it.

| file                                           | owner                                                                                                            |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `packages/sudoku-core/src/index.ts`            | one wave at a time: WP-B's four export lines, then WP-C's two, then WP-D's two, then WP-T1's one                 |
| `packages/sudoku-core/src/techniques/index.ts` | WP-D, handed to WP-D2                                                                                            |
| `apps/web/src/shared/api.ts`                   | **frozen** after wave 1 (decision 12) — changes are routed, not made                                             |
| `apps/web/package.json`                        | WP-E commits its server deps first; WP-F rebases its client deps on top and reports if the merge was non-trivial |
| `pnpm-lock.yaml`                               | the orchestrator, once, after a wave lands. Nobody else commits it                                               |
| `.github/workflows/ci.yml`                     | WP-A, handed to WP-G                                                                                             |
| `ORCHESTRATION.md`                             | WP-A, handed to WP-G (latency section)                                                                           |
| `apps/web/src/server/index.ts`                 | WP-E, handed to WP-G                                                                                             |
| `apps/web/src/client/App.tsx`                  | WP-F, WP-T2 takes over the nav line                                                                              |
| `pin.test.ts`                                  | WP-A wrote it `it.fails`; **WP-D2 flips it**                                                                     |

Wave 2 is the only wave with concurrency in the core+web split: WP-B is in
`packages/sudoku-core/src/{grid,solver}.ts`, WP-E in `apps/web/src/server/**`,
WP-F in `apps/web/src/client/**`. They share only `apps/web/package.json` and the
lockfile, both sequenced above.

## Package ledger

| WP       | what                                             | wave | status                               |
| -------- | ------------------------------------------------ | ---- | ------------------------------------ |
| **WP-A** | scaffold, contract, pin, CI                      | 1    | **done** — commits `fb42c78`..(this) |
| WP-B     | solver + grid utilities                          | 2    | pending                              |
| WP-E     | server: SQLite persistence + the five routes     | 2    | pending                              |
| WP-F     | client: playable board, level picker, history    | 2    | pending                              |
| WP-C     | reductive generator with injected rater          | 3    | pending                              |
| WP-D     | rater engine + techniques 1–10 + level targeting | 4    | pending                              |
| WP-D2    | techniques 11–14, calibration, flip the pin      | 5    | pending                              |
| WP-G     | integration, e2e, container                      | 6    | pending                              |
| WP-T1    | mine training examples                           | 6    | pending                              |
| WP-T2    | training section in the client                   | 7    | pending                              |

## What WP-A left for wave 2

- **`pnpm check` is green** with the pin reporting as an expected failure. Nothing
  is red on purpose except that.
- **The stubs throw, by design.** Every unimplemented export throws
  `NotImplemented` naming the package that owes it. A wave-2 failure that says
  `generate() is not implemented yet — WP-D lands it.` is the scaffold working,
  not a break. WP-E in particular hits this on `POST /api/game` and is expected
  to: its tests inject a puzzle source and use the fixtures.
- **Vitest** runs from `vitest.workspace.ts` at the root, with a project per
  package. `sudoku-core` includes `src/**/*.test.ts`; `web` includes the same and
  carries `passWithNoTests` because it has none yet. WP-F needs a DOM: add a third
  project (`web-client`, `environment: 'jsdom'`) and narrow `web` to `src/server`
  — the file says so in a comment, and that is the only edit it expects.
  `pnpm vitest run --project sudoku-core` narrows a run.
- **Dependencies.** Root dev tooling (typescript, eslint, prettier, vitest) lives
  in the **root** `package.json`; `packages/sudoku-core` has **none at all** and
  must stay that way (decision 3 — pure, dependency-free, no Node APIs). Fastify,
  `@fastify/static`, better-sqlite3, react, react-dom, vite and their types are
  already declared in `apps/web/package.json` so wave 2 doesn't fight over that
  file; they install and typecheck as they stand. better-sqlite3 compiles a native
  module on install.
- **The fixtures are the oracle.** `packages/sudoku-core/src/fixtures/known.ts` —
  six real SOTD puzzles with their published scores. Read the KNOWN DISCREPANCY
  note at the top before writing WP-D2's calibration assertions: decision 16's
  band table is not the same thing as SOTD's labels, and the tricky fixture is the
  one that shows it.
- **Node 22, pnpm 9**, pinned by `packageManager` in the root `package.json` and
  by `corepack enable` in CI.

## CI

`.github/workflows/ci.yml`, one job named **`check`**. That name is a contract:
branch protection on `main` lists it as a required status context. WP-G adds a
second job named **`docker`** and asks the human to add that context. Nobody
renames either.

`.github/workflows/codeql.yml` runs javascript-typescript analysis on push, PR
and weekly; it is not a required check.
