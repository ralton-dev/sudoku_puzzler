/**
 * Shell, nav and routes.
 *
 * The game hook lives here, above the router outlet, on purpose: walking over
 * to History must not unmount the board, because unmounting it would stop the
 * timer and abandon a debounced save. The active board is the default route
 * (`/`), and every unknown path falls back to it.
 *
 * WP-T2 adds `/training` and `/training/:technique` here and one more line in
 * `<nav>`; the router is `react-router` v8 (`BrowserRouter` is mounted in
 * `main.tsx`), so a nested route with `useParams()` is all that is needed.
 * v8 dropped the `react-router-dom` package: the declarative components all
 * come from `react-router` itself now, and the route structure is unchanged.
 */

import { useCallback, useState } from 'react';
import { NavLink, Route, Routes, Navigate } from 'react-router';
import { Board } from './Board';
import { History } from './History';
import { Keypad } from './Keypad';
import { LevelPicker } from './LevelPicker';
import { Timer } from './Timer';
import { formatElapsed } from './Timer';
import { TechniquePage, TrainingIndex } from './training';
import { useGame, type SaveState, type UseGame } from './useGame';

const SAVE_LABEL: Record<SaveState, string> = {
  idle: 'Up to date',
  saving: 'Saving…',
  saved: 'Saved',
  failed: 'Save failed — retrying',
};

function SaveIndicator({ state }: { state: SaveState }) {
  return (
    <span
      className={`save-indicator save-${state}`}
      data-testid="save-indicator"
      data-state={state}
      role="status"
    >
      {SAVE_LABEL[state]}
    </span>
  );
}

function GamePage({ game }: { game: UseGame }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [markMode, setMarkMode] = useState(false);

  const onSelect = useCallback((index: number | null) => setSelected(index), []);

  if (game.status === 'loading') return <p className="notice">Loading…</p>;

  if (game.status === 'error') {
    return (
      <p className="notice notice-bad">
        Could not reach the server{game.loadError ? `: ${game.loadError}` : ''}.
      </p>
    );
  }

  if (game.status === 'completed' || game.status === 'no-game') {
    return (
      <>
        {game.completed ? (
          <section className="done" data-testid="completion">
            <h2>Solved</h2>
            <p>
              {/* Only the level is capitalised. `text-transform: capitalize` on
                  the whole sentence turned the "in" into an "In". */}
              <span className="done-level">{game.completed.level}</span> in{' '}
              <strong>{formatElapsed(game.completed.elapsedMs)}</strong>.
            </p>
          </section>
        ) : null}
        <LevelPicker
          onPick={(level) => void game.startGame(level)}
          busy={false}
          heading={game.completed ? 'Next puzzle' : 'Start a puzzle'}
        />
      </>
    );
  }

  return (
    <section className="game">
      <div className="game-bar">
        <span className="game-level">{game.game?.level}</span>
        <Timer elapsedMs={game.elapsedMs} />
        <SaveIndicator state={game.saveState} />
      </div>
      {game.wrongCells.size > 0 ? (
        <p className="notice notice-bad" data-testid="wrong-notice">
          Not solved yet — {game.wrongCells.size}{' '}
          {game.wrongCells.size === 1 ? 'cell is' : 'cells are'} wrong.
        </p>
      ) : null}
      <Board
        givens={game.givens}
        cells={game.cells}
        selected={selected}
        onSelect={onSelect}
        conflicts={game.conflicts}
        digitCounts={game.digitCounts}
        wrongCells={game.wrongCells}
        markMode={markMode}
        onSetValue={game.setValue}
        onToggleMark={game.toggleMark}
        onClear={game.clearCell}
      />
      <Keypad
        selected={selected}
        markMode={markMode}
        onMarkModeChange={setMarkMode}
        onSetValue={game.setValue}
        onToggleMark={game.toggleMark}
        onClear={game.clearCell}
        onSelect={onSelect}
        digitCounts={game.digitCounts}
        locked={selected !== null && game.isGiven(selected)}
      />
    </section>
  );
}

export function App() {
  const game = useGame();

  return (
    <div className="app">
      <header className="app-header">
        {/*
          The mark is the board's own 3x3 box (`public/mark.svg`), and it is
          `alt=""` on purpose: the wordmark beside it already says the name, so
          a second reading of it would only make the heading stutter.
        */}
        <h1 className="app-brand">
          <img className="brand-mark" src="/mark.svg" alt="" width="28" height="28" />
          <span>Sudoku Puzzler</span>
        </h1>
        <nav className="app-nav">
          <NavLink to="/" end>
            Play
          </NavLink>
          <NavLink to="/training">Training</NavLink>
          <NavLink to="/history">History</NavLink>
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<GamePage game={game} />} />
          <Route path="/history" element={<History />} />
          <Route path="/training" element={<TrainingIndex />} />
          <Route path="/training/:technique" element={<TechniquePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
