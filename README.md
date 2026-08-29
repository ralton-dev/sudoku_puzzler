# sudoku puzzler

A sudoku generator, solver and difficulty rater, and a small web app to play
what it makes. `packages/sudoku-core` is a pure, dependency-free TypeScript
library: it builds 9x9 puzzles with exactly one solution and rates them on
[sudokuoftheday.com](https://www.sudokuoftheday.com/difficulty)'s cumulative
technique-cost scale, across six levels from beginner to diabolical. Rating a
puzzle means actually solving it the way a person would — cheapest technique
first, all the way up to swordfish — so the rater's output doubles as a
step-by-step explanation, which the app's training section uses to teach the
fourteen techniques from real positions. `apps/web` is the app: **the server
owns the game and the browser only renders it**, so your entered digits, your
pencil marks and your elapsed time are rows in SQLite, not tab state. Any device
on the network shows the same board, and a reload loses nothing.

**Running it.** Node 22 and pnpm 9. `pnpm install`, then `pnpm check` to run the
whole gate — lint, typecheck, test, build. `pnpm --filter web dev` boots the app
on `PORT` (default 8080); it is one process serving both the API and the client,
with no auth (the home lab gates it at the edge) and one SQLite file under
`DATA_DIR` (default `./data`). For a container, `docker compose up` builds and
runs the same thing with `/data` as a volume. Publishing the image and the
homelab Kubernetes manifests are deliberately out of scope here — next steps,
not part of this repo.

**Layout.** `packages/sudoku-core/src` holds the library: `types.ts` (the frozen
public shapes), `grid.ts` and `solver.ts` (bitmask backtracking, and the
uniqueness proof every served puzzle must pass), `generator.ts` (reductive
digging with the rater injected), `techniques/` (one file per technique, each
returning a rich step), `rater.ts` and `level.ts` (the score and the band it
falls in), `fixtures/known.ts` (six real puzzles with published scores, the
calibration oracle) and `training/` (mined example positions, committed as JSON).
`apps/web/src` splits three ways: `shared/` is the HTTP contract both sides
compile against, `server/` is Fastify plus the SQL migrations, and `client/` is
the React board, keypad, timer, history and training pages. `PLAN-sudoku-puzzler.md`
is the specification and `ORCHESTRATION.md` is how the work is run.
