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
pnpm --filter web build:client   # once, so there is a client to serve
pnpm --filter web dev            # tsx watch on the server
```

One process, one port (`PORT`, default 8080), SQLite under `DATA_DIR` (default
`./data`) — decisions 6 and 7. `curl localhost:8080/api/game` → 204 on a fresh
`DATA_DIR`.

`dev` stays **server-only** and is not going to run both halves concurrently.
The alternative was a `concurrently` dependency wrapping `tsx watch` and `vite`,
and it would have made the everyday boot a _different_ shape from the one that
ships: decision 7 is one process serving the API and the static client, and that
is exactly what `dev` is. Working on the client, run `pnpm --filter web
dev:client` alongside it — Vite on 5173 with hot reload, proxying `/api` to 8080
(`API_PROXY_TARGET` moves the target). Working on anything else, the built
client is served by the same server and there is one URL.

For the real thing, `docker compose up --build` (decision 6's volume included);
`HOST_PORT` moves it off 8080.

The e2e is `pnpm --filter web e2e` (`e2e:install` once for the browser). It
builds first and boots two servers of its own on 18090/18091 with throwaway
databases under the system temp directory, so it never touches `./data` and
never collides with a server you have running.

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

## State as of 2026-08-30

All ten plan packages landed on 2026-08-29; the plan is done. Since then, on
`main`, in order: the awkward fixture pencils its marks into the empty cell
(`bee19b9`); multi-arch CI publishing to `ghcr.io/ralton-dev/sudoku-puzzler`
(`aac1c02`); `/healthz`, `/readyz`, `APP_VERSION` and exclusive SQLite locking
for the NFS volume (`841f3c9`..`c0b0ac0`); same-digit highlighting, deselect
after entry, keypad counts with the nine-cap, "Pre-filled" in history
(`6d1804b`..`d2b2fdf`); the paper palette, self-hosted type, logo mark and
favicon set (`5f9b558`..`f561044`).

**Deployed** at `sudoku.ralton.dev` from the private `homelab-k8s` repo
(`manifests/sudoku-puzzler/`). A release is: push here → CI publishes
`sha-<full sha>` → bump `image:` and `APP_VERSION` in that manifest → Argo rolls
it (`Recreate`, one pod, RWO NFS volume). Verify a release by `/healthz`
reporting the tag, 0 restarts, and `/data` holding `sudoku.db` + `-wal` with
**no `-shm`**. Do not push a docs-only commit here while an image build is in
flight — the CI concurrency group cancels the build.

Offered, not asked for: an in-game hint button from the rater's `Step` trace.

**Dependabot majors #1–#8: all closed as superseded by `795275c`..`413898a`**,
which took every dependency and every action to its current release in one pass
— vitest 4, vite 8, React 19, react-router 8, `@fastify/static` 10, eslint 10,
Node 24, pnpm 11. Two things are deliberately held back and only two:
`typescript` on 5.9.3 (TypeScript 7 is the native compiler and ships no JS
compiler API, so typescript-eslint throws on load and takes `lint` — the first
step of the gate — with it; typescript-eslint#10940 tracks it) and
`@types/node` on the 24 line, so the types describe the runtime the container
actually runs.

## Package ledger

| WP        | what                                             | wave | status                                         |
| --------- | ------------------------------------------------ | ---- | ---------------------------------------------- |
| **WP-A**  | scaffold, contract, pin, CI                      | 1    | **done** — `fb42c78`..                         |
| **WP-B**  | solver + grid utilities                          | 2    | **done**                                       |
| **WP-E**  | server: SQLite persistence + the five routes     | 2    | **done**                                       |
| **WP-F**  | client: playable board, level picker, history    | 2    | **done**                                       |
| **WP-C**  | reductive generator with injected rater          | 3    | **done**                                       |
| **WP-D**  | rater engine + techniques 1–10 + level targeting | 4    | **done**                                       |
| **WP-D2** | techniques 11–14, calibration, flip the pin      | 5    | **done** — the pin is a plain `it` (`83805a3`) |
| **WP-G**  | integration, e2e, container                      | 6    | **done** — this file, `f3ae48b`..              |
| WP-T1     | mine training examples                           | 6    | **done** — `aab4349`..`906637e`                |
| WP-T2     | training section in the client                   | 7    | **done** — `e6d154b`..`42b7c45`                |

## What WP-A left for wave 2

- **`pnpm check` is green** with the pin reporting as an expected failure. Nothing
  is red on purpose except that.
- **The stubs throw, by design.** Every unimplemented export throws
  `NotImplemented` naming the package that owes it. A wave-2 failure that says
  `generate() is not implemented yet — WP-D lands it.` is the scaffold working,
  not a break. WP-E in particular hits this on `POST /api/game` and is expected
  to: its tests inject a puzzle source and use the fixtures.
- **Vitest** runs from `test.projects` in `vitest.config.ts` at the root, with a
  project per package. (WP-A wrote this as `defineWorkspace` in a
  `vitest.workspace.ts`; that file was deprecated in Vitest 3, removed in 4, and
  the three projects moved across unchanged in `795275c`.) `sudoku-core`
  includes `src/**/*.test.ts`; `web` narrows to `src/server/**` and carries
  `passWithNoTests`; `web-client` is the DOM half (`environment: 'jsdom'`, with
  `src/client/test-setup.ts`). The three **names are a contract** — scripts, CI
  and this file all use them. `pnpm vitest run --project sudoku-core` narrows a
  run.
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
- **Node 24, pnpm 11**, pinned by `engines` and `packageManager` in the root
  `package.json` and by `corepack enable` in CI. (WP-A scaffolded Node 22 and
  pnpm 9; Node 22 went into maintenance in October 2025 and 24 is the Active
  LTS.) pnpm 11 needs two things the scaffold did not: dependency lifecycle
  scripts are opt-in, so `better-sqlite3` and `esbuild` are named in
  `allowBuilds` in `pnpm-workspace.yaml`, and `pnpm deploy` in the Dockerfile
  takes `--legacy`.

## CI

`.github/workflows/ci.yml`, three jobs — `check`, `docker` (a two-leg matrix)
and `docker-merge` — and the names are contracts. Branch protection on `main`
lists three of the four resulting status contexts as required:

| context                | job                         | runs on                                                      | required |
| ---------------------- | --------------------------- | ------------------------------------------------------------ | -------- |
| `check`                | `check`                     | `ubuntu-latest`                                              | yes      |
| `docker (linux/amd64)` | `docker`, `platform` matrix | `ubuntu-latest`                                              | yes      |
| `docker (linux/arm64)` | `docker`, `platform` matrix | `homelab-arm64` on push-to-`main`, `ubuntu-24.04-arm` on PRs | yes      |
| `docker-merge`         | `docker-merge`              | `ubuntu-latest`                                              | **no**   |

`docker-merge` is deliberately not required: it is gated on
`github.event_name == 'push' && github.ref == 'refs/heads/main'`, so on a pull
request it never reports, and a required context that never reports blocks every
PR forever. The sibling repo `ralton-dev/finance-planner` requires exactly the
same set — its per-platform legs and not its merge — and this mirrors it.

**The human still has to set the required-check list**; the tree cannot do it:

```
gh api -X PATCH repos/ralton-dev/sudoku_puzzler/branches/main/protection/required_status_checks \
  -F strict=true -f 'contexts[]=check' \
  -f 'contexts[]=docker (linux/amd64)' -f 'contexts[]=docker (linux/arm64)'
```

(`-F`, not `-f`, for `strict` — `-f` sends a string and the API rejects it
with 422. The matrix contexts contain a space and a slash; quote them.) This
replaces the old single `docker` context, which no longer exists.

`check` is `pnpm check` plus the Playwright e2e. The e2e is deliberately _not_ a
job of its own: another job would be another required context to negotiate, and
the e2e has nothing to say that `check` should not already be saying. Chromium is
cached on the lockfile hash.

`docker` builds **one architecture per leg, on a runner of that architecture** —
never under emulation. The runner is chosen by one expression:

```
runs-on: ${{ (matrix.platform == 'linux/arm64' && github.event_name == 'push' && github.ref == 'refs/heads/main') && 'homelab-arm64' || (matrix.platform == 'linux/arm64' && 'ubuntu-24.04-arm' || 'ubuntu-latest') }}
```

amd64 is always GitHub's hosted `ubuntu-latest`. arm64 on a push to `main` goes
to `homelab-arm64` — the org-level ARC runner in the home lab, runner group
`Default`, shared with `finance-planner`. arm64 on a pull request falls back to
GitHub's hosted `ubuntu-24.04-arm`, which is free for public repos: a fork PR
fires `pull_request` and must never be able to select an in-cluster runner.

Each leg pushes **by digest only** (no tag) to
`ghcr.io/ralton-dev/sudoku-puzzler`, and `docker-merge` assembles the two digests
into one manifest list with `docker buildx imagetools create`, tagged
`sha-<full-commit-sha>` and `latest`. Nothing beyond `GITHUB_TOKEN` and
`packages: write` is needed to push to GHCR; there are no repo or org secrets in
play. `permissions:` is `contents: read` at the workflow level, with
`packages: write` added on the two jobs that push.

Every leg still **boots the image it just built and plays one hand**: 204 on a
fresh volume, 201 on `POST {level:medium}`. Building only proves it compiles;
better-sqlite3 is a native module and the runtime stage has no compiler, so
booting it is the half that could fail — and it has to be checked on each
architecture separately, which is the whole reason the smoke lives inside the
matrix. The push-by-digest build hands its layers to buildkit rather than to the
docker daemon, so a second `load: true` build re-exports the same (fully cached)
result as a local image for `docker run`.

`.github/workflows/codeql.yml` runs javascript-typescript analysis on push, PR
and weekly; it is not a required check.

## Deployment contract

This repo is deployed to Ben's home-lab k3s cluster; the cluster's contract for
app repos and the deployment plan live in the (private) `homelab-k8s` repo, not
here — this tree is public and carries nothing about the cluster. Take care
before changing anything the deployment leans on: the health endpoints
(`server/health.ts`), the SQLite locking mode (`server/db.ts`), the container's
`HEALTHCHECK`, the image tags CI publishes, or the environment variables the
README's configuration table lists — that table is what the ConfigMap is built
from, so a new variable that is not in it does not reach the cluster.

Two things in it are decisions rather than facts, recorded in the README:
migrations run at **boot** rather than as a separate job (SQLite
is single-writer on one RWO volume, and `/readyz` holds traffic off until the
schema is current), and `locking_mode = EXCLUSIVE` is on by default with
`SQLITE_EXCLUSIVE=false` as the opt-out (see the pitfall below).

Nothing here deploys itself. The manifests live in `homelab-k8s` and a human
points them at a new `sha-<full-sha>` tag; Argo CD does the rest.

## Generation latency, and why there is no `puzzle_pool`

The plan (WP-G) said: add a server-side pre-generation pool in a `puzzle_pool`
table if `diabolical` takes more than 3 s to generate on the Mac, and don't if
it doesn't. It doesn't. **No pool was added.**

Measured through the real, built server — `node dist/server/index.js`, real
`generate({level, seed: Date.now()})`, 5 × `POST /api/game` per level, the row
deleted between calls, timed as the full HTTP round trip (M-series MacBook Pro,
Node 22, 2026-08-29):

| level        | median | worst | samples (ms)      |
| ------------ | ------ | ----- | ----------------- |
| `beginner`   | 3 ms   | 25 ms | 2, 3, 3, 3, 25    |
| `easy`       | 4 ms   | 5 ms  | 3, 4, 4, 4, 5     |
| `medium`     | 3 ms   | 4 ms  | 2, 2, 3, 4, 4     |
| `tricky`     | 18 ms  | 33 ms | 5, 14, 18, 32, 33 |
| `fiendish`   | 20 ms  | 22 ms | 8, 17, 20, 21, 22 |
| `diabolical` | 7 ms   | 21 ms | 4, 6, 7, 11, 21   |

Worst case across all six levels is **33 ms**, two orders of magnitude inside
the budget, and that figure includes Fastify, the uniqueness re-check on the
insert path (`checkServable`) and the SQLite write. `tricky` is the slow one,
not `diabolical` — the same inversion WP-D2 measured in `level.test.ts`, and it
is not noise: `tricky`'s band is narrow and sits directly under the cheap
techniques' ceiling, so the digger overshoots and steps back more often than it
does for a level that can use anything.

A pool would therefore have bought nothing and cost a table, a migration, a
background writer and a new way for the one-active-game invariant to be wrong.
Revisit only if the numbers move by ~50×.

## Pitfalls, learned the hard way

Things that cost someone an afternoon. Read before repeating them.

1. **The partial unique index must be on the expression, not the column.**
   `CREATE UNIQUE INDEX ... ON games (completed_at) WHERE completed_at IS NULL`
   enforces _nothing_ — every row in that index holds NULL, and SQL considers
   NULLs distinct, so any number of rows fit. `ON games ((completed_at IS NULL))`
   gives every active row the same non-NULL key, which is what makes decision 8
   a constraint the database keeps rather than a promise the route makes.
   `001_init.sql` says so at the point of use; don't "simplify" it.
2. **Decision 17's step-back budget spans multiple dig passes**, not one. It is
   a budget for the whole `generatePuzzle` call, and reading it as per-pass makes
   the generator give up far too early on the hard bands.
3. **SOTD's `multipleLines` already covers box/line reduction.** Don't add a
   separate box/line-reduction technique — decision 16's fourteen are the whole
   ladder and its costs are calibrated as a set.
4. **An `it.fails` pin flips to red the moment the gap closes.** That is the
   alarm working, not a break: it means the thing the pin was waiting for now
   works and the pin owes an edit to a plain `it`. WP-D2 did that in `83805a3`.
5. **`pnpm-lock.yaml` is committed by the orchestrator only**, once, after a
   wave lands. Adding deps to your own `package.json` is fine; staging the lock
   is not.
6. **A scaffold that pins versions from memory is a generation behind before
   anyone has run it.** WP-A wrote the whole dependency set out by hand on
   2026-08-29 and it looked plausible: vitest 2, vite 6, React 18,
   `react-router-dom` 6, `@fastify/static` 8, eslint 9, Node 22, pnpm 9. Within
   a day Dependabot had opened eight major-bump PRs against it, and the real
   cost was not the bumps — it was that every one of them arrived _after_ the
   code was written against the old API, so the vitest move had to be made
   twice over. **Resolve every version live before you write the manifest**:
   `npm view <pkg> version`, `gh api repos/<owner>/<action>/releases/latest
--jq .tag_name`, and the Node release schedule (`nodejs/Release`'s
   `schedule.json`) for which LTS is _active_ rather than merely supported.
   The same trap caught the base image from the other side: `.github/dependabot.yml`
   pointed its docker ecosystem at `/apps/web`, where the Dockerfile was once
   expected to land, so Dependabot found nothing and never offered a base-image
   bump at all — `node:22-slim` went a whole LTS stale in silence. A dependency
   nobody is watching is pinned, not stable.
7. **`sudoku-core`'s barrel is not loadable by plain Node ESM.**
   `src/training/index.ts` does `import examples from './examples.json'`, which
   Node requires an import attribute for. Everything in the tree survives
   because everything bundles — vite, vitest and esbuild all inline the JSON —
   but anything that transpiles and lets Node load the result (Playwright, or a
   bare `node` against the unbundled `tsc` output) fails on any
   `import … from 'sudoku-core'`. `apps/web/e2e` imports `grid`/`solver` by
   path for that reason. **Fixed in `906637e`**: the import now carries
   `with { type: 'json' }` (`training/index.ts`) and the barrel loads under
   plain Node; keep the attribute — bundlers emit identical output either way.
8. **The awkward fixture's six pencil marks were stored but not drawn.**
   `awkward.ts` put them on cells that also carry a digit, and `Cell.tsx` hides
   marks behind a digit deliberately (a resumed board should look like the one
   the player left, not a tidied-up version) — so the fixture was awkward in the
   database and tidy on screen. **Resolved**: the six marks now go in the one
   empty cell (the candidates the player pencilled into the hole), which is the
   only place marks are ever drawn, and the e2e asserts the six _rendered_ marks
   on load.
9. **An absolute path that works on the author's machine is a green local run
   and a red CI one.** WP-G's e2e screenshots were hard-coded to a scratchpad
   directory outside the repo; both specs failed in CI with `EACCES` on `mkdir`.
   Artefact paths are resolved from `import.meta.url`, default under a
   gitignored `test-results/`, overridable by an env var — and writing one never
   fails a test, because a screenshot is evidence, not an assertion.
10. **Never assert a state the app is in the middle of destroying.** The e2e
    checked that all 81 cells were filled, but the client attempts completion
    the instant the grid is full and valid and unmounts the board on success —
    so the assertion was racing the app's own success path. It won locally and
    lost in CI, where the failure screenshot showed "Solved — medium in 00:02".
    The fix was not a longer timeout: it was to assert the durable thing the
    server wrote (the completed row's cells) instead of the transient thing on
    screen. If an assertion can only be true for a few milliseconds, it is the
    wrong assertion.
11. **Renaming a required status context locks `main` until a human catches
    up.** `docker` became `docker (linux/amd64)` and `docker (linux/arm64)` when
    it became a matrix. The old `docker` context can never report again, and a
    required check that never reports blocks every pull request — the branch is
    protected by a job that no longer exists. The `gh api -X PATCH` above is not
    a nicety; run it in the same sitting as the merge. The same trap catches the
    reverse: adding `docker-merge` to the list would block every PR, because it
    is push-to-`main`-only and never reports on a PR at all.
12. **A GHCR package created by a workflow is private, whatever the repository
    is.** The first push to `ghcr.io/ralton-dev/sudoku-puzzler` creates the
    package and links it to this repo, and `docker pull` from outside still gets
    a 401 until someone sets its visibility to public once, by hand, in the org's
    package settings. `finance-planner`'s images are public and anonymously
    pullable, so the flip has been done there and is the precedent. Nothing in
    the workflow can do it: `packages: write` publishes, it does not govern.
13. **`locking_mode = EXCLUSIVE` locks out every other connection, not just
    every other process.** It is on by default (`SQLITE_EXCLUSIVE`, `db.ts`)
    because it is what makes WAL safe on the home lab's NFS volume. Under it a
    second `new Database(file)` gets `SQLITE_BUSY: database is locked`
    immediately — same process or another, read-write **or** read-only, even
    against a completely idle database. There is no lazy-lock behaviour to hope
    for; SQLite takes the lock on first access and keeps it. So a test or a
    tool that opens the server's file alongside the server has to either use
    the app's own handle (which is why the harness exports `db`) or boot that
    server with `SQLITE_EXCLUSIVE=false`, which is what `apps/web/e2e` does and
    says so in `e2e/servers.ts`.
14. **`locking_mode = EXCLUSIVE` has to be set _before_ `journal_mode = WAL`,
    and the wrong order looks right.** The deployment contract says to add it
    "right after the WAL pragma"; that is wrong, and it fails in the only case
    that matters. SQLite keeps the WAL index in heap — the whole point, the
    thing that makes WAL safe on NFS — only if exclusive locking is set before
    the first WAL-mode access, and on a database that already exists
    `PRAGMA journal_mode` is one, because it reads the header to answer. So on
    a fresh file both orders work, and on the second boot onto a volume that
    already holds the file, WAL-then-EXCLUSIVE creates the `-shm` anyway. The
    trap is that `locking_mode` still reads back `exclusive`, so the pragma
    test the contract suggests passes with the guarantee gone. Caught by
    running the real container against a volume from an earlier run, not by the
    unit tests, which all started from an empty directory. `db.test.ts` now
    closes and reopens.
