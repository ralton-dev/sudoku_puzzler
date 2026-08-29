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

**Configuration.** Every setting is an environment variable with a default, and
nothing reads a config file — the server starts with none of these set. There
are **no secrets**: no auth (the edge gates the hostname), no database
credentials (SQLite on a volume), no API keys, so a deployment needs a ConfigMap
at most.

| Variable           | Default                                   | Meaning                                                                                                  |
| ------------------ | ----------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `PORT`             | `8080`                                    | listen port                                                                                              |
| `HOST`             | `0.0.0.0`                                 | bind address                                                                                             |
| `DATA_DIR`         | `./data` (image: `/data`)                 | directory holding `sudoku.db` — the only path the process writes to                                      |
| `CLIENT_DIR`       | `<bundle>/../client` → `/app/dist/client` | built SPA to serve; serves the API only, with a warning, if it is absent                                 |
| `MIGRATIONS_DIR`   | `<bundle>/migrations`                     | numbered `.sql` files, applied at boot                                                                   |
| `APP_VERSION`      | `dev` (compose: `local`)                  | reported by `/healthz`; a deployment sets it to the image tag                                            |
| `SQLITE_EXCLUSIVE` | `true`                                    | `locking_mode = EXCLUSIVE` — see below. `false` only where a second process must open the file           |
| `NODE_ENV`         | `production` (image)                      | —                                                                                                        |
| `SUDOKU_FIXTURE`   | unset                                     | **dev/e2e only** — `<level>` or `awkward` serves committed fixtures instead of generating. Never in prod |

`SUDOKU_FIXTURE` refuses to boot on a value that is not `awkward` or one of the
six levels, rather than silently ignoring it.

**Health.** Two unauthenticated probes outside `/api/*`, cheap enough to run
every ten seconds forever:

- `GET /healthz` → `200 {"status":"ok","version":"<APP_VERSION>"}`. Liveness. It
  touches no database, because the answer to a liveness failure is "restart the
  process" and a restart cannot mount a missing volume.
- `GET /readyz` → `200 {"status":"ready"}`. Readiness. It asks the open handle
  for `count(*) FROM schema_migrations` and checks that the newest migration
  file is recorded; when either fails it answers `503` with a `not-ready`
  status and a `reason`, rather than throwing.

The container's `HEALTHCHECK`, the CI smoke test and the e2e's server wait all
use `/readyz`, so there is one health story rather than three.

**Migrations run at boot**, from `MIGRATIONS_DIR`, in filename order, each file
inside a transaction with the row that records it in `schema_migrations`. They
are idempotent and forward-only; there is no down migration and no rollback.

This is a deliberate, recorded deviation from the home lab's rule that
migrations run as a separate job before the new version rolls out. SQLite is
single-writer on one ReadWriteOnce volume, so a migration job would need the
same volume the running server holds and — with the exclusive lock below —
could not open the file at all while the old pod was up. Boot-time migration
plus a readiness gate satisfies what that rule is actually for: `/readyz` is
503 until the schema is current, so no traffic reaches a pod whose schema is
behind. A deployment of this image wants `strategy: Recreate` — one pod at a
time on one volume — which RWO storage forces anyway.

**SQLite locking.** The database opens in WAL mode with
`locking_mode = EXCLUSIVE` and `busy_timeout = 5000`. WAL's shared-memory index
(`-shm`) is only coherent between processes on a single host, which makes plain
WAL unsafe on the NFS volume this runs on in the home lab; exclusive locking
keeps that index in heap memory and the `-shm` file is never created. The
trade-off is that **nothing else can open the file while the server is up** —
`sqlite3 /data/sudoku.db` from a debug shell gets `database is locked`, and so
does a read-only connection. Stop the process, or copy the file first. Set
`SQLITE_EXCLUSIVE=false` where a second process genuinely has to read it; the
e2e suite is the only thing in this repo that does.

**Network.** Deny-by-default namespaces need every path written down, so here
they are. Inbound, all to the one container port:

| From                        | Port | Why                       |
| --------------------------- | ---- | ------------------------- |
| the ingress (Traefik)       | 8080 | serving the app           |
| the uptime monitor (gatus)  | 8080 | `/readyz`                 |
| the dashboard (Homepage)    | 8080 | status                    |
| kubelet, from the node CIDR | 8080 | liveness/readiness probes |

Outbound: **none**. The server makes no HTTP calls at all — the generator, the
rater, the fixtures and the training examples are all in-process, and the
client bundle is self-contained and served by this same process. There are no
analytics, no update checks and no CDN or font fetches. The one URL in the
bundle (`https://www.sudokuoftheday.com/…`) is a provenance string in
`fixtures/known.ts` and is never fetched. DNS is the only egress a policy needs
to allow, and only because the standard set includes it.

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
