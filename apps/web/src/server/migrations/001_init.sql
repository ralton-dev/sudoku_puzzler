-- 001_init — the whole persistence model (decision 6).
--
-- One table. A game is a row; the active game is the row with completed_at
-- NULL; history is every row with completed_at set (decision 8: there is at
-- most one active row, and there is no abandon/delete, so a row only ever goes
-- active -> completed).
--
-- cells_json is the user's whole board state as the contract's CellState[]
-- (81 entries, `{value, marks}`), stored verbatim because progress saves are
-- whole-state PUTs (decision 11) and nothing server-side ever queries inside it.

CREATE TABLE games (
  id          TEXT PRIMARY KEY,
  level       TEXT    NOT NULL,
  givens      TEXT    NOT NULL CHECK (length(givens) = 81),
  solution    TEXT    NOT NULL CHECK (length(solution) = 81),
  seed        INTEGER NOT NULL,
  cells_json  TEXT    NOT NULL,
  elapsed_ms  INTEGER NOT NULL DEFAULT 0,
  started_at  TEXT    NOT NULL,
  completed_at TEXT
);

-- Decision 8 at the DB level, not just in the route: at most one row may have
-- completed_at IS NULL.
--
-- NOTE, and this is the whole point of writing it this way: the obvious
--   CREATE UNIQUE INDEX ... ON games (completed_at) WHERE completed_at IS NULL
-- enforces NOTHING. Every row in that index has the value NULL in the indexed
-- column, and SQL considers NULLs distinct from each other, so a unique index
-- over them permits any number of rows (verified against SQLite 3.49.2).
-- Indexing the constant-true *expression* instead gives every active row the
-- same non-NULL key, which is what actually makes "one active game" a
-- constraint the database keeps rather than a promise the route makes.
CREATE UNIQUE INDEX games_one_active ON games ((completed_at IS NULL)) WHERE completed_at IS NULL;

-- GET /api/history is "newest completedAt first" over completed rows only.
CREATE INDEX games_completed_at ON games (completed_at DESC) WHERE completed_at IS NOT NULL;
