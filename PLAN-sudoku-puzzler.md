# Plan: Sudoku Puzzler — core library + playable home-lab web app

Status: unstarted. Written 2026-08-29 against an **empty, non-git directory**. There is no
`ORCHESTRATION.md` and no prior plan; WP-A creates the first of each. Decision numbering
starts at 1.

## The defect this plan closes

There is nothing to disagree with yet, so the "defect" is the gap between what exists and
what must be checkable when the plan is done:

| surface                                 | today               | when done                                                                 |
| --------------------------------------- | ------------------- | ------------------------------------------------------------------------- |
| `packages/sudoku-core`                  | does not exist      | `generate({level})` returns a 9x9 puzzle with exactly one solution rated at that level |
| `packages/sudoku-core/src/pin.test.ts`  | does not exist      | red pin (below) is a plain passing assertion                              |
| `GET /api/game`                         | does not exist      | returns the one active game with every entered cell + pencil mark + elapsed ms |
| browser reload mid-puzzle               | n/a                 | board comes back exactly as left, timer continues from saved elapsed      |
| `GET /api/history`                      | does not exist      | every completed puzzle with level, completedAt, elapsedMs                  |

**Reframing in one sentence:** *the server owns the game, the browser only renders it* —
the active puzzle, the user's cell entries, pencil marks and elapsed time are server-side
rows, so any device on the home lab shows the same board and nothing is lost on reload.

## Decisions — numbered, do not relitigate

1. **9x9 only.** No board-size parameter anywhere in the public API. Types are fixed-size
   (`Grid = Uint8Array(81)`); do not generalise "for later".
2. **Monorepo: pnpm workspaces + TypeScript.** `packages/sudoku-core` (library, private,
   unpublished) and `apps/web` (server + client). Node 22, pnpm 9 (both present locally).
3. **Core library is pure and dependency-free** — no Node APIs, no I/O, no RNG other than
   an injected seeded PRNG (`mulberry32`-style, seed: number). Determinism is an
   acceptance criterion: same seed → same puzzle.
4. **Difficulty = hardest human technique required**, not clue count. Five levels, in
   order: `easy`, `medium`, `hard`, `expert`, `evil`. The technique ladder and its
   mapping to levels is WP-D's; the *level names* are fixed here and appear in the DB and
   the API verbatim.
5. **Uniqueness is absolute.** Every puzzle served has exactly one solution, proven by
   `countSolutions(grid, limit=2) === 1`. A puzzle that fails this is never persisted.
6. **Server: Fastify + better-sqlite3**, single SQLite file at `DATA_DIR/sudoku.db`
   (default `./data`). Schema migrations are plain numbered SQL files applied at boot.
   The home lab mounts `DATA_DIR` as a volume; nothing else is stateful.
7. **Client: Vite + React + TypeScript**, served as static files by the same Fastify
   process. One container, one port (`PORT`, default 8080). No auth — Cloudflare Access
   gates it at the edge, exactly like every other homelab app.
8. **Exactly one active game.** `POST /api/game` returns **409** if one exists. There is
   **no abandon/delete endpoint** in this plan — a puzzle stays until completed (the
   user's stated requirement). Do not add one "for convenience".
9. **Elapsed time is client-measured, server-stored, informational only.** The client
   ticks while the tab is visible and sends `elapsedMs` with every progress save; the
   server stores the latest value and copies it into history on completion. No pause
   button, no anti-cheat, no server-side clock reconciliation.
10. **Completion is verified server-side** — `POST /api/game/complete` compares the
    saved cells with the stored solution; the client never sends "I'm done, trust me".
11. **Progress saves are whole-state PUTs**, debounced client-side (≤ 1 per 500 ms),
    plus one on `visibilitychange`/`pagehide`. No per-cell PATCH, no websockets.
12. **The API contract is frozen in `apps/web/src/shared/api.ts` by WP-A** so server
    (WP-E) and client (WP-F) build against it concurrently. Changing a type there after
    wave 1 requires the change to be routed to both packages' briefs explicitly.
13. **Deletion rule:** any package that replaces a stub or earlier implementation deletes
    it in the same commit and reports per symbol — deleted, or kept with who still calls it.
14. **Git conventions (Ben's standing rules):** conventional commits with scope
    (`feat(core): …`, `feat(web): …`, `chore(repo): …`), no `Co-Authored-By` trailers,
    stage owned paths by name only, never `git add -A`/`git stash`/`git restore`/
    `git checkout --`. Commit direct to `main`.

## The red pin

WP-A lands `packages/sudoku-core/src/pin.test.ts` as `it.fails` (vitest) with these
assertions, against stubs that throw `NotImplemented`:

```ts
// Pin: the whole point of the library, in one test.
// Written 2026-08-29 before any implementation existed; all three stubs throw.
for (const level of ['easy','medium','hard','expert','evil'] as const) {
  const p = generate({ level, seed: 1 });
  expect(countSolutions(p.givens, 2)).toBe(1);
  expect(rate(p.givens).level).toBe(level);
  expect(generate({ level, seed: 1 }).givens).toEqual(p.givens); // deterministic
}
```

**WP-D flips it to a plain `it(...)` as part of its acceptance.** Until then CI is green
and the tree documents that the gap is known.

## Work packages

### WP-A · Scaffold, contract, pin, CI

**Goal:** a git repo with green CI, a workspace that type-checks and tests, the frozen
core API and HTTP contract, the red pin, and the first `ORCHESTRATION.md`.

- `git init`, `main` branch, `.gitignore` (node_modules, dist, data/, *.db, coverage).
  Remote is `github.com/ralton-dev/sudoku_puzzler` — **creating it is the human's step**
  (see "What to bring the human"); WP-A adds the remote if it exists, otherwise notes it.
- `pnpm-workspace.yaml`, root `package.json` with scripts `lint`, `typecheck`, `test`,
  `build`, `check` (= all four in that order). Root `tsconfig.base.json` (strict, ES2022,
  `noUncheckedIndexedAccess`). ESLint flat config + Prettier. Vitest at root with
  workspace projects.
- `packages/sudoku-core/src/`:
  - `types.ts` — `Grid` (Uint8Array length 81, 0 = empty), `Level` union (decision 4),
    `Puzzle { givens: Grid; solution: Grid; level: Level; seed: number }`, `Rating
    { level: Level; hardestTechnique: string; techniques: string[] }`.
  - `rng.ts` — seeded PRNG, `createRng(seed): () => number` + `shuffle`.
  - `index.ts` — exports `generate`, `solve`, `countSolutions`, `rate`, `isValidGrid`,
    `isComplete`, types. All function bodies `throw new NotImplemented('WP-x')`.
  - `pin.test.ts` — the red pin, `it.fails`.
  - `fixtures/` — **five** hand-picked published puzzles, one per level, as 81-char
    strings with their known solutions, in `fixtures/known.ts`. Source and stated
    difficulty recorded in a comment per puzzle. (Ben will supply rating resources —
    WP-A uses well-known public examples; WP-D may replace them.)
- `apps/web/` skeleton: `package.json`, `tsconfig`, `src/shared/api.ts` — the **frozen
  HTTP contract** (decision 12):

  ```ts
  type CellState = { value: 0|1|…|9; marks: number[] };           // marks: pencil digits
  type ActiveGame = { id: string; level: Level; givens: string;   // 81 chars
                      cells: CellState[]; elapsedMs: number; startedAt: string };
  type HistoryEntry = { id: string; level: Level; startedAt: string;
                        completedAt: string; elapsedMs: number; givens: string };
  GET  /api/game            → 200 ActiveGame | 204 (none)
  POST /api/game {level}    → 201 ActiveGame | 409 {error:'active-game-exists'}
  PUT  /api/game/progress {cells, elapsedMs} → 200 ActiveGame | 404
  POST /api/game/complete   → 200 HistoryEntry | 409 {error:'not-solved', wrongCells:number[]} | 404
  GET  /api/history         → 200 HistoryEntry[] (newest first)
  ```
- `.github/workflows/ci.yml` — pnpm install (frozen lockfile), `pnpm check`, on push
  and PR to `main`. Node 22.
- `ORCHESTRATION.md` — verification gate is `pnpm check`; boot is `pnpm --filter web
  dev`; the decisions above are referenced not restated; the freeze/commit rules from
  decision 14; the choke-point files from the wave table.
- `README.md` — three paragraphs: what, how to run, layout.

**Acceptance:** `pnpm check` green locally with the pin reporting as expected-failure;
CI green on the first push (or, if no remote yet, the workflow file lints and the
orchestrator records that CI is unverified); `apps/web/src/shared/api.ts` compiles and
is imported by nothing yet.

Owns: everything in the repo at this point (it is alone). Size **M**. Depends: none.

### WP-B · Solver and grid utilities

**Goal:** a fast, correct backtracking solver that proves uniqueness.

- `packages/sudoku-core/src/grid.ts` — `parseGrid(str81)`, `formatGrid(grid)`,
  peer/unit tables precomputed once (`ROWS`, `COLS`, `BOXES`, `PEERS[81]`),
  `isValidGrid` (no duplicate in any unit, ignoring zeros), `isComplete` (valid + no
  zeros), `candidates(grid, idx): bitmask`.
- `packages/sudoku-core/src/solver.ts` — bitmask backtracking with MRV cell choice.
  `solve(grid): Grid | null`, `countSolutions(grid, limit): number` (stops at `limit`),
  and `solveRandom(grid, rng)` (random value order — WP-C uses it to build full grids).
- Replace the `NotImplemented` stubs for `solve`, `countSolutions`, `isValidGrid`,
  `isComplete` in `index.ts` (the `index.ts` **re-export lines only** — WP-B owns those
  four lines; WP-C/WP-D own theirs).
- Tests: the five fixtures solve to their known solutions; a grid with two solutions
  returns `countSolutions === 2`; an empty grid `countSolutions(…, 2) === 2` in under
  50 ms; the "hardest for brute force" 17-clue puzzle solves in under 200 ms (record the
  measurement in the test comment); invalid grid (duplicate in row) → `solve` returns
  `null`.

**Acceptance:** per-rule tests above green; measured timings recorded; stubs deleted
(per-symbol report).

Owns: `packages/sudoku-core/src/grid.ts`, `solver.ts`, their `*.test.ts`, and the four
named export lines in `index.ts`. Size **M**. Depends: WP-A.

### WP-C · Generator (uniqueness, no level targeting yet)

**Goal:** `generatePuzzle({seed, symmetry?})` returns a minimal-ish puzzle with exactly
one solution, deterministically.

- `packages/sudoku-core/src/generator.ts`:
  - full grid: `solveRandom(emptyGrid, rng)` from WP-B.
  - dig: remove cells in a seeded random order (rotational symmetry pairs by default),
    keep a removal only if `countSolutions(grid, 2) === 1`. Continue until a pass
    removes nothing (local minimality) or a clue floor (default 22) is hit.
  - returns `{ givens, solution, seed }` — **no `level`**; WP-D wraps it.
- Tests: deterministic for a seed; 20 seeds → all unique; clue counts logged; median
  generation time recorded in a comment (target < 300 ms per puzzle on the Mac; if it
  is slower, say so — WP-D's targeting loop calls this repeatedly).

**Acceptance:** per-rule tests green; timing recorded; `generatePuzzle` exported from
`index.ts` (its one line).

Owns: `packages/sudoku-core/src/generator.ts` + test, one export line in `index.ts`.
Size **M**. Depends: WP-B.

### WP-D · Rater, level targeting, flip the pin

**Goal:** `rate(grid)` reports the hardest human technique needed; `generate({level,
seed})` returns a puzzle rated exactly at that level; the pin is green.

- `packages/sudoku-core/src/techniques/` — one file per technique, each
  `(state) => Step | null` over a candidate-bitmask state: `nakedSingle`,
  `hiddenSingle`, `pointingPair` (box→line), `boxLineReduction`, `nakedPair`,
  `hiddenPair`, `nakedTriple`, `hiddenTriple`, `xWing`, `swordfish`, `xyWing`, plus a
  terminal `guess` marker if the ladder exhausts (→ `evil`).
- `packages/sudoku-core/src/rater.ts` — runs the ladder cheapest-first to completion,
  returns `Rating`. Level mapping (initial, WP-D may tune against Ben's resources and
  **must record the final table in `ORCHESTRATION.md`**):
  easy = singles only · medium = + pointing/box-line/naked pair · hard = + hidden pair,
  triples · expert = + X-wing, swordfish, XY-wing · evil = needs a guess.
- `packages/sudoku-core/src/level.ts` — `generate({level, seed})`: loop
  `generatePuzzle({seed: seed+i})` until `rate().level === level`; give up after N
  attempts with a thrown `GenerationFailed` naming the level. Record the observed
  attempts-per-level distribution in the test comment — `evil` may be rare, and
  **if any level cannot be produced within 200 attempts, report it rather than widening
  the level's definition**.
- Tests: each of the five fixtures rates at its stated level (this is where Ben's
  resources matter — if a fixture disagrees with the ladder, report which, don't
  silently reclassify); every technique file has a positive and a negative unit test on
  a hand-built state; **flip `pin.test.ts` from `it.fails` to `it`**.
- Delete the `generate`/`rate` stubs and the `NotImplemented` class if nothing else
  throws it.

**Acceptance:** pin green as a plain `it`; five fixture ratings green; attempts
distribution recorded; `pnpm check` green.

Owns: `packages/sudoku-core/src/techniques/**`, `rater.ts`, `level.ts`, their tests,
`pin.test.ts`, two export lines in `index.ts`, the level-table section of
`ORCHESTRATION.md`. Size **L**. Depends: WP-B, WP-C.

### WP-E · Web server: persistence + API

**Goal:** the API in `shared/api.ts` works end to end against SQLite, with the core
library as the only puzzle source.

- `apps/web/src/server/db.ts` — open `DATA_DIR/sudoku.db`, WAL mode, run
  `migrations/*.sql` in order, track in `schema_migrations`.
- `apps/web/src/server/migrations/001_init.sql`:
  - `games(id TEXT PK, level TEXT, givens TEXT(81), solution TEXT(81), seed INTEGER,
    cells_json TEXT, elapsed_ms INTEGER, started_at TEXT, completed_at TEXT NULL)`
  - partial unique index enforcing **one row with `completed_at IS NULL`** (decision 8
    at the DB level, not just the route).
- `apps/web/src/server/routes.ts` — the five routes exactly as contracted; completion
  compares `cells[i].value` to `solution[i]` and returns the wrong indices on 409.
- `apps/web/src/server/index.ts` — Fastify, `@fastify/static` serving
  `apps/web/dist/client` with SPA fallback, listens on `PORT`.
- Until WP-D lands, `POST /api/game` calls `generate({level, seed: Date.now()})` which
  throws `NotImplemented` — **that's fine and expected in wave 2**; WP-E's tests inject a
  puzzle source (`{ generate }` passed to `buildApp`) and use fixture puzzles.
- Tests (vitest + `app.inject`, temp DB per test): 204 when no game; 201 then 409;
  progress round-trips marks and elapsedMs; complete with wrong cell → 409 with the
  index; complete correct → history entry and next `GET /api/game` is 204; history
  newest first; **DB-level uniqueness: inserting a second active row directly fails**.

**Acceptance:** all per-rule tests green; `pnpm --filter web dev` boots and `curl
localhost:8080/api/game` → 204 on a fresh `DATA_DIR`.

Owns: `apps/web/src/server/**`, `apps/web/package.json` server deps (add only; WP-F adds
client deps in the same file — **coordinate: WP-E commits `package.json` first; WP-F
rebases its dep additions on top and reports if the merge was non-trivial**). Size
**M**. Depends: WP-A.

### WP-F · Web client: playable board, level picker, history

**Goal:** a person can pick a level, play the puzzle with keyboard and mouse, close the
tab, reopen it, and be exactly where they were.

- `apps/web/src/client/` — Vite + React. Files: `main.tsx`, `App.tsx`, `api.ts` (typed
  fetch wrappers over `shared/api.ts`), `Board.tsx`, `Cell.tsx`, `Keypad.tsx`,
  `LevelPicker.tsx`, `Timer.tsx`, `History.tsx`, `useGame.ts` (state + debounced save),
  `styles.css`.
- Behaviour:
  - App load → `GET /api/game`; 204 shows `LevelPicker` only; 200 shows the board.
  - Givens are locked and visually distinct. Arrow keys move; 1–9 enters; `0`/Backspace/
    Delete clears; **Shift+digit toggles a pencil mark**; a toggle for mark-mode on the
    keypad for touch.
  - Conflicts (same digit in a peer) are highlighted but **never blocked** — user's call.
  - Timer shows `elapsedMs`, ticks only while `document.visibilityState === 'visible'`.
  - Save: debounced 500 ms after any change; also on `visibilitychange` → hidden and
    `pagehide` (use `keepalive: true` on the fetch). Show a small "saved / saving /
    save failed" indicator; **never lose input on a failed save — retry with backoff**.
  - When every cell is filled and valid, call `/api/game/complete`; on 200 show the
    time and a "new puzzle" level picker; on 409 highlight `wrongCells`.
  - `History` view: table of completed puzzles (level, date, time, clue count),
    reachable from a nav link; the active board is always the default route.
- Vite dev proxy `/api` → `localhost:8080`; build output `apps/web/dist/client`.
- Tests: `useGame` with a mocked fetch — debounce collapses rapid edits into one PUT;
  hidden → immediate save; 409 on complete marks the wrong cells. Component tests for
  Board keyboard handling (givens immutable, Shift+digit toggles marks).
- **Browser check is required, done first not last:** run against WP-E's server with a
  fixture puzzle injected via a dev-only env `SUDOKU_FIXTURE=easy` (WP-E provides this
  hook — one line in `server/index.ts`; WP-E owns it, WP-F asks for it in its report if
  missing) and attach a screenshot of a mid-game board to the report.

**Acceptance:** the per-rule tests green; in a real browser: play three cells and two
marks, reload, all five are back and the timer resumed from ≥ the saved value.

Owns: `apps/web/src/client/**`, `apps/web/index.html`, `apps/web/vite.config.ts`, client
deps in `apps/web/package.json` (see WP-E note). Size **L**. Depends: WP-A (contract);
runs concurrently with WP-E.

### WP-G · Integration, e2e, container

**Goal:** one `docker run` gives the whole thing; an e2e proves persistence and
completion with real generated puzzles.

- Wire the real `generate` into `server/index.ts` (remove the WP-E fixture-source
  default in production; keep `SUDOKU_FIXTURE` for e2e).
- `Dockerfile` (multi-stage: pnpm build → `node:22-slim` runtime, `DATA_DIR=/data`,
  `VOLUME /data`, `EXPOSE 8080`, non-root user). `docker-compose.yml` for local run.
  `.github/workflows/ci.yml` gains a `docker build` job (no push — publishing the image
  and the homelab-k8s manifest are **out of scope**; note them in README as next steps).
- Playwright e2e in `apps/web/e2e/`: fresh DB → pick `medium` → board appears with a
  puzzle whose givens `countSolutions === 1` (call core directly from the test) → enter
  values → reload → present → fill the solution (read `solution` straight from the DB
  file in the test, never from the API) → completion → history has one row with
  `elapsedMs > 0` → `GET /api/game` 204 → `POST` a new `evil` game succeeds. Record
  generation time for each level in the report (this is the first time the real
  generator meets the real server).
- **Generation latency guard:** if `evil` takes > 3 s to generate on the Mac, add a
  server-side background pre-generation of one puzzle per level into a `puzzle_pool`
  table (migration `002_pool.sql`) and report the numbers. Don't add the pool if the
  numbers don't demand it.
- Build the awkward fixture (see "fixture shape" below) and play it in the e2e.

**Acceptance:** `docker compose up` → playable at `:8080`; e2e green in CI; per-level
generation latency table in the report and in `ORCHESTRATION.md`.

Owns: `Dockerfile`, `docker-compose.yml`, `apps/web/e2e/**`, `apps/web/src/server/index.ts`
(handed over from WP-E — WP-E is finished by then), `.github/workflows/ci.yml`,
`README.md`, `ORCHESTRATION.md` (latency section). Size **L**. Depends: WP-D, WP-E, WP-F.

## Wave table

| Wave | Packages         | Notes                                                                                   |
| ---- | ---------------- | --------------------------------------------------------------------------------------- |
| 1    | WP-A             | alone — owns the whole tree, creates the contract everyone else builds against          |
| 2    | WP-B + WP-E + WP-F | disjoint: `packages/sudoku-core/src/{grid,solver}.ts` vs `apps/web/src/server/**` vs `apps/web/src/client/**`. Shared file `apps/web/package.json`: WP-E commits first, WP-F rebases (see WP-E). `index.ts` export lines: WP-B only in this wave. |
| 3    | WP-C             | alone — only core package changes; nothing else pending                                 |
| 4    | WP-D             | alone — owns `index.ts` export lines, `pin.test.ts`, `ORCHESTRATION.md` section          |
| 5    | WP-G             | alone — owns the choke points (`ci.yml`, `server/index.ts`, `README.md`)                |

Checked against `Owns`: wave 2's three file sets share no file except `apps/web/package.json`
(sequenced above) and `pnpm-lock.yaml` (regenerated by whichever commits last; the
orchestrator runs `pnpm install` and commits the lock once after the wave lands — nobody
else commits it).

**Choke points, never co-owned:** `packages/sudoku-core/src/index.ts`,
`apps/web/src/shared/api.ts` (frozen after wave 1 — changes are routed, not made),
`apps/web/package.json`, `pnpm-lock.yaml`, `.github/workflows/ci.yml`, `ORCHESTRATION.md`.

Rough total: **5 waves**, 7 packages, three of them concurrent in wave 2.

## The regression to fear

Greenfield, so the fear is an invariant silently not holding rather than a number moving:

- **A served puzzle with more than one solution.** The completion check compares against
  *the stored* solution, so a multi-solution puzzle would reject a correct alternative
  fill and the user would be told they're wrong when they aren't. Decision 5 is
  enforced at generation (WP-C) and re-checked in the e2e (WP-G) from the DB, not the
  API. Hunt for the assumption *"givens uniquely determine the solution"* anywhere the
  solution string is read.
- **Progress lost on a hidden tab.** The debounce is the assumption: an edit followed
  within 500 ms by a tab close must still save (`pagehide` + `keepalive`). WP-F proves
  it in a real browser; the e2e re-proves it.
- **A second active game.** The 409 is the route's assumption; the partial unique
  index is the truth. If they ever disagree the index wins — WP-E tests both.

**The assumption to hunt for, in every package:** *"the board is empty when the app
loads."* Every component, hook and route must be correct when the first thing it sees
is a half-finished puzzle with pencil marks and a non-zero timer.

## The fixture shape this plan's tests avoid

Tests naturally use a fresh game, a tidy easy puzzle, and a clean fill-in-order. The live
defect will be found on: a puzzle **one cell from complete with a wrong digit and six
pencil marks in the same box**, loaded on reload, with the timer already past an hour.
WP-G builds exactly that state directly in the DB and plays it through the e2e; WP-F
uses it (via `SUDOKU_FIXTURE=awkward`) for its browser screenshot.

## Notes to every agent

- `file:line` references in this plan are **hints to verify** — grep for the symbol,
  confirm it says what the plan claims, and report drift rather than working around it.
- If a premise here is wrong, say so and serve its intent, not its letter.
- Report per symbol what you deleted. Report what your change makes incoherent outside
  your files; do not patch outside your `Owns`.
- Emit output between steps; commit before any long final verification; browser passes
  first, not last.

## What to bring the human (settle before wave 1)

1. **Create the GitHub remote** `ralton-dev/sudoku_puzzler` (private is fine) — WP-A needs
   it for CI to be verifiable. `gh repo create ralton-dev/sudoku_puzzler --private` from the
   repo after WP-A's first commit, or before and WP-A adds the remote.
2. **The rating resources** Ben mentioned — hand them to the orchestrator; they go into
   WP-D's brief (and may replace WP-A's fixtures). Without them WP-D uses the ladder in
   decision-4/WP-D as written.
3. Confirmed by this plan, not asked again: no abandon button (decision 8), no auth
   (decision 7), SQLite on a volume (decision 6), React (decision 7).
