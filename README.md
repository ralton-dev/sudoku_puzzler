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

**Running it in a container.** This is the way it is meant to be run:
`docker compose up --build`, then <http://localhost:8080>. One image, one
process, one port, and a named volume holding the SQLite file — `docker compose
down` (without `-v`) leaves the puzzle you were in the middle of exactly where
it was. Put it on another port with `HOST_PORT=9000 docker compose up`. There is
no auth by design: the home lab gates it at the edge, like everything else
there.

**The published image.** Every push to `main` publishes a multi-architecture
image — `linux/amd64` and `linux/arm64`, each built on a runner of its own
architecture rather than under emulation — to
`ghcr.io/ralton-dev/sudoku-puzzler`, tagged `latest` and `sha-<commit>`:

```
docker run --rm --publish 8080:8080 --volume sudoku-data:/data \
  ghcr.io/ralton-dev/sudoku-puzzler:latest
```

Pin `sha-<commit>` rather than `latest` anywhere it matters; `latest` moves on
every push. The remaining next step is the homelab Kubernetes manifest that
deploys this image — that lives in the home lab's own repo, not this one.

**Running it from source.** Node 22 and pnpm 9. `pnpm install`, then `pnpm
check` for the whole gate — lint, typecheck, test, build, in that order.
`pnpm --filter web dev` boots the server on `PORT` (default 8080) with the
SQLite file under `DATA_DIR` (default `./data`); it serves the API and,
if `apps/web/dist/client` exists, the built client with it — so run
`pnpm --filter web build:client` once and that one URL is the whole app.
While working on the client, leave that server running and add
`pnpm --filter web dev:client` in a second terminal: Vite on 5173 with hot
reload, proxying `/api` to 8080 (`API_PROXY_TARGET` moves the target).

**The end-to-end suite.** `pnpm --filter web e2e:install` once for the browser,
then `pnpm --filter web e2e`. It builds the server and the client, boots two of
them on throwaway databases, and drives a real Chromium through a real
generated puzzle: pick a level, prove the givens have exactly one solution, type
digits, reload, fill the solution read straight out of the SQLite file, and
finish. The second spec starts from a board one cell from complete with a wrong
digit and an hour on the clock, and proves an edit still saves when the page is
closed inside the save debounce. CI runs both.

**Layout.** `packages/sudoku-core/src` holds the library: `types.ts` (the frozen
public shapes), `grid.ts` and `solver.ts` (bitmask backtracking, and the
uniqueness proof every served puzzle must pass), `generator.ts` (reductive
digging with the rater injected), `techniques/` (one file per technique, each
returning a rich step), `rater.ts` and `level.ts` (the score and the band it
falls in), `fixtures/known.ts` (six real puzzles with published scores, the
calibration oracle) and `training/` (mined example positions, committed as JSON).
`apps/web/src` splits three ways: `shared/` is the HTTP contract both sides
compile against, `server/` is Fastify plus the SQL migrations, and `client/` is
the React board, keypad, timer, history and training pages; `apps/web/e2e` is
the Playwright suite. `Dockerfile` and `docker-compose.yml` are the container.
`PLAN-sudoku-puzzler.md` is the specification and `ORCHESTRATION.md` is how the
work is run.
