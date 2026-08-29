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
4. **Difficulty = the sudokuoftheday.com cumulative technique-cost score.** Source of
   truth: https://www.sudokuoftheday.com/difficulty (read 2026-08-29; the tables are
   copied into decision 16 so agents never need the network). Six levels, in order:
   `beginner`, `easy`, `medium`, `tricky`, `fiendish`, `diabolical`. The level names are
   fixed here and appear in the DB and the API verbatim. Not "hardest technique", not
   clue count.
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
15. **Public repo under the org with the org's standard protections** (mirrored from
    `ralton-dev/finance-planner`, the most complete public sibling, read 2026-08-29):
    - visibility **public**, licence **MIT**, org `ralton-dev`.
    - classic branch protection on `main`: 1 required approving review, dismiss stale
      reviews, required conversation resolution, required linear history, no force
      pushes, no deletions, **required status checks strict** (contexts = the CI job
      names, added once they exist), **`enforce_admins: false`** — this is what keeps
      Ben's direct-to-main workflow (decision 14) working: Ben is org admin and bypasses
      the PR gate; anyone else (Dependabot, a fork) must go through a reviewed, green PR.
    - security_and_analysis: secret scanning **on**, push protection **on**, Dependabot
      security updates **on**, vulnerability alerts **on**.
    - in-tree: `LICENSE` (MIT), `.github/dependabot.yml` (weekly Monday 06:00
      Europe/London, npm minor+patch grouped, github-actions, docker for `apps/web`),
      `.github/workflows/codeql.yml` (javascript-typescript).
    Settings that live in GitHub, not the tree, are applied by the human via
    `/tmp/sudoku-repo-setup.sh` (see "What to bring the human") — agents never call the
    GitHub settings API.
16. **Scoring table (from sudokuoftheday.com/difficulty, verbatim).** The rater applies
    techniques cheapest-first, restarting from the top after every successful
    application; each application adds its cost; the sum is the score.

    | # | technique (SOTD name) | our id | first use | subsequent |
    |---|---|---|---|---|
    | 1 | Single Candidate | `nakedSingle` | 100 | 100 |
    | 2 | Single Position | `hiddenSingle` | 100 | 100 |
    | 3 | Candidate Lines | `candidateLines` (pointing pair/triple) | 350 | 200 |
    | 4 | Double Pairs | `doublePairs` | 500 | 250 |
    | 5 | Multiple Lines | `multipleLines` | 700 | 400 |
    | 6 | Naked Pair | `nakedPair` | 750 | 500 |
    | 7 | Hidden Pair | `hiddenPair` | 1500 | 1200 |
    | 8 | Naked Triple | `nakedTriple` | 2000 | 1400 |
    | 9 | Hidden Triple | `hiddenTriple` | 2400 | 1600 |
    | 10 | X-Wing | `xWing` | 2800 | 1600 |
    | 11 | Forcing Chains | `forcingChains` | 4200 | 2100 |
    | 12 | Naked Quad | `nakedQuad` | 5000 | 4000 |
    | 13 | Hidden Quad | `hiddenQuad` | 7000 | 5000 |
    | 14 | Swordfish | `swordfish` | 8000 | 6000 |

    SOTD's published ranges overlap (beginner 3600–4500, easy 4300–5500, medium
    5300–6900, tricky 6500–9300, fiendish 8300–14000, diabolical 11000–25000). **We
    resolve overlaps by lower bound** so `levelOf(score)` is a function:
    beginner `< 4300` · easy `4300–5299` · medium `5300–6499` · tricky `6500–8299` ·
    fiendish `8300–10999` · diabolical `≥ 11000`. A puzzle the ladder cannot finish
    (needs a guess) has no score and is **rejected by the generator**, never served.
17. **Generation is reductive with difficulty targeted during digging** (from
    sudokuoftheday.com/creation): full grid → remove rotationally-symmetric cell pairs
    (centre cell alone) at random → after ~15 pairs, rate after every removal → revert
    a removal that breaks uniqueness, makes the ladder stall, or overshoots the target
    band's max → stop when the score is inside the target band → discard the whole grid
    after a step-back budget (default 300) and start again. The rater is therefore a
    *dependency of the generator*, injected as a callback so the packages stay in
    separate files.

## The red pin

WP-A lands `packages/sudoku-core/src/pin.test.ts` as `it.fails` (vitest) with these
assertions, against stubs that throw `NotImplemented`:

```ts
// Pin: the whole point of the library, in one test.
// Written 2026-08-29 before any implementation existed; all three stubs throw.
for (const level of LEVELS) {                       // all six, decision 4
  const p = generate({ level, seed: 1 });
  expect(countSolutions(p.givens, 2)).toBe(1);
  expect(rate(p.givens)?.level).toBe(level);        // rate() is null if the ladder stalls
  expect(generate({ level, seed: 1 }).givens).toEqual(p.givens); // deterministic
}
```

**WP-D2 flips it to a plain `it(...)` as part of its acceptance.** Until then CI is green
and the tree documents that the gap is known.

## Work packages

### WP-A · Scaffold, contract, pin, CI

**Goal:** a git repo with green CI, a workspace that type-checks and tests, the frozen
core API and HTTP contract, the red pin, and the first `ORCHESTRATION.md`.

- Repo already initialised with the plan committed. Remote is
  `github.com/ralton-dev/sudoku_puzzler` (public) — **creating it and applying decision
  15's protections is the human's step**; WP-A pushes if `origin` exists, otherwise
  reports that CI is unverified.
- `.gitignore` (node_modules, dist, data/, *.db, coverage), `LICENSE` (MIT, copyright
  "Ben Ralton"), `.github/dependabot.yml` and `.github/workflows/codeql.yml` per
  decision 15 — copy the shape from `ralton-dev/finance-planner`, trimmed to this
  repo's one Docker directory.
- `pnpm-workspace.yaml`, root `package.json` with scripts `lint`, `typecheck`, `test`,
  `build`, `check` (= all four in that order). Root `tsconfig.base.json` (strict, ES2022,
  `noUncheckedIndexedAccess`). ESLint flat config + Prettier. Vitest at root with
  workspace projects.
- `packages/sudoku-core/src/`:
  - `types.ts` — `Grid` (Uint8Array length 81, 0 = empty), `Level` union (decision 4),
    `Puzzle { givens: Grid; solution: Grid; level: Level; seed: number }`, `Rating
    { score: number; level: Level; steps: Array<{technique: TechniqueId; cost: number}> }`
    and `TechniqueId` (the 14 ids in decision 16, in ladder order).
  - `rng.ts` — seeded PRNG, `createRng(seed): () => number` + `shuffle`.
  - `index.ts` — exports `generate`, `solve`, `countSolutions`, `rate`, `isValidGrid`,
    `isComplete`, types. All function bodies `throw new NotImplemented('WP-x')`.
  - `pin.test.ts` — the red pin, `it.fails`.
  - `fixtures/known.ts` — **six** puzzles from sudokuoftheday.com, one per level, as
    81-char strings with their solutions **and SOTD's published score**, each with its
    source URL and date in a comment. These are the calibration oracle for WP-D2; if a
    level's puzzle can't be found with a published score, say so in the report.
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
- `.github/workflows/ci.yml` — one job named **`check`** (pnpm install with frozen
  lockfile, then `pnpm check`), on push and PR to `main`, Node 22. **The job name is a
  contract**: it becomes a required status check in branch protection. WP-G adds a
  second job named **`docker`**; nobody renames either.
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
- Tests: the six fixtures solve to their known solutions; a grid with two solutions
  returns `countSolutions === 2`; an empty grid `countSolutions(…, 2) === 2` in under
  50 ms; the "hardest for brute force" 17-clue puzzle solves in under 200 ms (record the
  measurement in the test comment); invalid grid (duplicate in row) → `solve` returns
  `null`.

**Acceptance:** per-rule tests above green; measured timings recorded; stubs deleted
(per-symbol report).

Owns: `packages/sudoku-core/src/grid.ts`, `solver.ts`, their `*.test.ts`, and the four
named export lines in `index.ts`. Size **M**. Depends: WP-A.

### WP-C · Reductive generator with injected rater

**Goal:** `generatePuzzle({seed, target, rate})` digs a full grid down to a puzzle whose
score lands in `target` — decision 17 — with the rater passed in, so this package needs
no knowledge of techniques.

- `packages/sudoku-core/src/generator.ts`:
  - full grid: `solveRandom(emptyGrid, rng)` from WP-B.
  - `generatePuzzle(opts: { seed: number; target: {min:number;max:number};
    rate: (g: Grid) => Rating | null; stepBackBudget?: number })`.
  - dig loop exactly as decision 17: symmetric pairs, centre alone; before ~15 pairs
    only check `countSolutions(g,2)===1`; after, also call `rate`; revert on
    non-unique / `null` / `score > target.max`; return when `min ≤ score ≤ max`; throw
    `GenerationFailed({seed, stepBacks})` when the budget is spent.
  - `shuffleGrid(grid, rng)` — the SOTD variant trick (swap rows/cols within bands,
    swap bands/stacks, transpose, digit permutation); used on the full grid before
    digging so seeds diverge cheaply.
- Tests use a **fake rater** (e.g. `score = 100 × empty cells`) so WP-C is testable in
  its wave: deterministic per seed; returns inside the band; reverts are counted;
  `GenerationFailed` after the budget with an impossible band; uniqueness holds for
  every returned puzzle across 30 seeds. Record median dig time with the fake rater.

**Acceptance:** per-rule tests green; `generatePuzzle` and `GenerationFailed` exported
(their lines in `index.ts`); the fake-rater timing recorded in the test comment.

Owns: `packages/sudoku-core/src/generator.ts` + test, two export lines in `index.ts`.
Size **M**. Depends: WP-B.

### WP-D · Rater engine + techniques 1–10 + level targeting

**Goal:** `rate(grid)` returns a decision-16 score using techniques 1–10; `generate({level,
seed})` produces a puzzle in that level's band; the pin stays `it.fails` only because
techniques 11–14 are WP-D2's.

- `packages/sudoku-core/src/techniques/` — one file per technique, `(state) => Step |
  null` over a candidate-bitmask state, ids exactly as decision 16. WP-D writes
  `nakedSingle`, `hiddenSingle`, `candidateLines`, `doublePairs`, `multipleLines`,
  `nakedPair`, `hiddenPair`, `nakedTriple`, `hiddenTriple`, `xWing`. `doublePairs` and
  `multipleLines` are SOTD's names for box/line reduction variants — read
  https://www.sudokuoftheday.com/techniques for each before implementing and cite the
  definition in the file header; **don't substitute a "standard" technique of your own
  choosing**.
- `packages/sudoku-core/src/techniques/index.ts` — `LADDER: TechniqueId[]` in cost
  order and `COSTS` table (decision 16). WP-D2 appends its four ids here.
- `packages/sudoku-core/src/rater.ts` — the loop from decision 16, returning `Rating`
  or `null` on stall. `levelOf(score)` per decision 16.
- `packages/sudoku-core/src/level.ts` — `BANDS`, `generate({level, seed})` =
  `generatePuzzle({seed, target: BANDS[level], rate})` retried with `seed+i` on
  `GenerationFailed`, up to 20 grids; then throws. Record observed grids-per-level and
  wall time per level in the test comment. **If `fiendish`/`diabolical` are
  unreachable with techniques 1–10, say so — that is expected and is WP-D2's job.**
- Delete the `generate`/`rate` stubs from WP-A (per-symbol report).
- Tests: each technique positive + negative on a hand-built state; the six fixtures:
  every one whose SOTD score is ≤ tricky must rate at its level; the two hardest may
  return `null` here.

**Acceptance:** fixtures beginner–tricky rate at their level; scores recorded next to
SOTD's published ones; `generate` works for beginner–tricky; `pnpm check` green.

Owns: `packages/sudoku-core/src/techniques/{index,nakedSingle,…,xWing}.ts`, `rater.ts`,
`level.ts`, their tests, two export lines in `index.ts`. Size **L**. Depends: WP-B,
WP-C.

### WP-D2 · Techniques 11–14, calibration, flip the pin

**Goal:** the full ladder; every level reachable; the pin green; our scores calibrated
against SOTD's.

- `techniques/forcingChains.ts`, `nakedQuad.ts`, `hiddenQuad.ts`, `swordfish.ts`;
  append to `LADDER` in `techniques/index.ts`. Forcing chains per SOTD's definition
  (bounded-depth implication chains from a bivalue cell — cite the page); it is the
  expensive one, so measure it.
- Calibration test: for each of the six fixtures, our score vs SOTD's published score,
  **asserting the level matches** and recording the delta. If a fixture lands in the
  wrong band, report which technique the trace shows firing differently rather than
  tuning costs — costs are decision 16 and are not to be adjusted.
- **Flip `pin.test.ts` to a plain `it`.** Record grids-per-level and wall time for
  `fiendish` and `diabolical` in the test comment; if either exceeds 3 s on the Mac
  this feeds WP-G's pool decision.

**Acceptance:** pin green; six fixture levels match; timing table recorded; `pnpm
check` green.

Owns: the four technique files + tests, `techniques/index.ts` (handed over from WP-D),
`pin.test.ts`, `level.test.ts` timing comment. Size **L**. Depends: WP-D.

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
  `elapsedMs > 0` → `GET /api/game` 204 → `POST` a new `diabolical` game succeeds. Record
  generation time for each level in the report (this is the first time the real
  generator meets the real server).
- **Generation latency guard:** if `diabolical` takes > 3 s to generate on the Mac, add a
  server-side background pre-generation of one puzzle per level into a `puzzle_pool`
  table (migration `002_pool.sql`) and report the numbers. Don't add the pool if the
  numbers don't demand it.
- Build the awkward fixture (see "fixture shape" below) and play it in the e2e.

**Acceptance:** `docker compose up` → playable at `:8080`; e2e green in CI; per-level
generation latency table in the report and in `ORCHESTRATION.md`.

Owns: `Dockerfile`, `docker-compose.yml`, `apps/web/e2e/**`, `apps/web/src/server/index.ts`
(handed over from WP-E — WP-E is finished by then), `.github/workflows/ci.yml`,
`README.md`, `ORCHESTRATION.md` (latency section). Size **L**. Depends: WP-D2, WP-E, WP-F.

## Wave table

| Wave | Packages         | Notes                                                                                   |
| ---- | ---------------- | --------------------------------------------------------------------------------------- |
| 1    | WP-A             | alone — owns the whole tree, creates the contract everyone else builds against          |
| 2    | WP-B + WP-E + WP-F | disjoint: `packages/sudoku-core/src/{grid,solver}.ts` vs `apps/web/src/server/**` vs `apps/web/src/client/**`. Shared file `apps/web/package.json`: WP-E commits first, WP-F rebases (see WP-E). `index.ts` export lines: WP-B only in this wave. |
| 3    | WP-C             | alone — generator with a fake rater; only core package changes                          |
| 4    | WP-D             | alone — owns `techniques/index.ts`, `rater.ts`, `level.ts`, `index.ts` export lines      |
| 5    | WP-D2            | alone — takes over `techniques/index.ts` and `pin.test.ts`                              |
| 6    | WP-G             | alone — owns the choke points (`ci.yml`, `server/index.ts`, `README.md`)                |

Checked against `Owns`: wave 2's three file sets share no file except `apps/web/package.json`
(sequenced above) and `pnpm-lock.yaml` (regenerated by whichever commits last; the
orchestrator runs `pnpm install` and commits the lock once after the wave lands — nobody
else commits it).

**Choke points, never co-owned:** `packages/sudoku-core/src/index.ts`,
`packages/sudoku-core/src/techniques/index.ts`,
`apps/web/src/shared/api.ts` (frozen after wave 1 — changes are routed, not made),
`apps/web/package.json`, `pnpm-lock.yaml`, `.github/workflows/ci.yml`, `ORCHESTRATION.md`.

Rough total: **6 waves**, 8 packages, three of them concurrent in wave 2.

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

1. **Create the public org repo and apply its protections** — run
   `! bash /tmp/sudoku-repo-setup.sh` (creates `ralton-dev/sudoku_puzzler` public,
   pushes `main`, enables secret scanning / push protection / Dependabot security
   updates / vulnerability alerts, applies the classic `main` protection from decision
   15 with `check` as the required context; logs to `/tmp/sudoku-repo-setup.log`).
   Required-check context `docker` is added after WP-G lands — the orchestrator asks
   for it then, with the one-line command.
2. ~~Rating resources~~ — received 2026-08-29: sudokuoftheday.com/difficulty and
   /creation, folded into decisions 4, 16, 17. Nothing further needed.
3. Confirmed by this plan, not asked again: no abandon button (decision 8), no auth
   (decision 7), SQLite on a volume (decision 6), React (decision 7).
