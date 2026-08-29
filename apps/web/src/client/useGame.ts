/**
 * The whole client-side game: load, edit, tick, save, complete.
 *
 * Two things here are load-bearing and easy to get wrong.
 *
 * 1. **The board is not empty when the app loads.** The first thing this hook
 *    sees is whatever the server has — very often a half-finished puzzle with
 *    pencil marks and an elapsed time past an hour. Every initial value below
 *    is therefore taken from the loaded `ActiveGame`, never from a blank
 *    default: the cells, the marks, and the timer's starting point.
 *
 * 2. **Input is never lost to a failed save.** Every edit lands in React state
 *    first and is saved from there. A save is a whole-state PUT (decision 11),
 *    so a retry is always "send the latest state again" and never "replay the
 *    edits I dropped". A failure schedules a backed-off retry against the
 *    current state; the user keeps typing throughout.
 *
 * Saves are debounced 500 ms, and forced immediately when the tab is hidden or
 * the page is going away (`keepalive`, so the request outlives the page).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ActiveGame, CellState, Digit, HistoryEntry, Level, SaveProgressBody } from '../shared/api';
import { completeGame, createGame, fetchActiveGame, saveProgress } from './api';

export const SAVE_DEBOUNCE_MS = 500;
const RETRY_BASE_MS = 500;
const RETRY_MAX_MS = 8_000;
const TICK_MS = 1_000;
/** The timer alone is worth a save on hide once it has moved this far. */
const TIMER_SAVE_THRESHOLD_MS = 1_000;

const EMPTY_SET: ReadonlySet<number> = new Set<number>();

export type SaveState = 'idle' | 'saving' | 'saved' | 'failed';
export type GameStatus = 'loading' | 'no-game' | 'playing' | 'completed' | 'error';

// --- geometry -------------------------------------------------------------
// The client needs peers only to highlight conflicts. sudoku-core owns the real
// tables, but this hook must work in wave 2 before they land and must not pull
// a solver into the browser to draw a red cell, so the 81x20 peer table is
// built here, once, at module load.

const PEERS: readonly (readonly number[])[] = (() => {
  const peers: number[][] = [];
  for (let i = 0; i < 81; i++) {
    const r = Math.floor(i / 9);
    const c = i % 9;
    const br = Math.floor(r / 3) * 3;
    const bc = Math.floor(c / 3) * 3;
    const set = new Set<number>();
    for (let k = 0; k < 9; k++) {
      set.add(r * 9 + k);
      set.add(k * 9 + c);
    }
    for (let dr = 0; dr < 3; dr++) {
      for (let dc = 0; dc < 3; dc++) set.add((br + dr) * 9 + bc + dc);
    }
    set.delete(i);
    peers.push([...set]);
  }
  return peers;
})();

/**
 * Cells whose digit repeats in a row, column or box. Both offenders are
 * returned — a conflict has no innocent party — and nothing is blocked because
 * of it (the plan is explicit: highlighted, never blocked).
 */
export function computeConflicts(cells: readonly CellState[]): ReadonlySet<number> {
  const bad = new Set<number>();
  for (let i = 0; i < cells.length; i++) {
    const value = cells[i]?.value ?? 0;
    if (value === 0) continue;
    for (const p of PEERS[i] ?? []) {
      if ((cells[p]?.value ?? 0) === value) {
        bad.add(i);
        bad.add(p);
      }
    }
  }
  return bad.size === 0 ? EMPTY_SET : bad;
}

/**
 * The server's cells, made safe to render: always 81 of them, marks sorted and
 * in range, and a given always showing its own digit. Defensive rather than
 * distrustful — it means a truncated or partial payload degrades to a playable
 * board instead of an exception mid-render.
 */
export function cellsFromGame(game: ActiveGame): CellState[] {
  return Array.from({ length: 81 }, (_, i) => {
    const given = game.givens[i] ?? '0';
    if (given !== '0') return { value: Number(given) as Digit, marks: [] };
    const cell = game.cells[i];
    const marks = (cell?.marks ?? []).filter((d) => d >= 1 && d <= 9);
    return {
      value: (cell?.value ?? 0) as Digit,
      marks: [...new Set(marks)].sort((a, b) => a - b),
    };
  });
}

function blankCells(): CellState[] {
  return Array.from({ length: 81 }, () => ({ value: 0 as Digit, marks: [] }));
}

export interface UseGame {
  status: GameStatus;
  game: ActiveGame | null;
  /** 81 chars, '0' = empty. '' while there is no game. */
  givens: string;
  cells: CellState[];
  elapsedMs: number;
  saveState: SaveState;
  conflicts: ReadonlySet<number>;
  /** indices the server said are wrong, from a 409 on complete */
  wrongCells: ReadonlySet<number>;
  completed: HistoryEntry | null;
  loadError: string | null;
  isGiven: (index: number) => boolean;
  setValue: (index: number, digit: Digit) => void;
  toggleMark: (index: number, digit: number) => void;
  clearCell: (index: number) => void;
  startGame: (level: Level) => Promise<void>;
  dismissCompletion: () => void;
  /** force a save now; exported for the completion path and for tests */
  flushSave: () => Promise<void>;
}

export function useGame(): UseGame {
  const [status, setStatus] = useState<GameStatus>('loading');
  const [game, setGame] = useState<ActiveGame | null>(null);
  const [cells, setCells] = useState<CellState[]>(blankCells);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [wrongCells, setWrongCells] = useState<ReadonlySet<number>>(EMPTY_SET);
  const [completed, setCompleted] = useState<HistoryEntry | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Mutable mirrors: timers and event listeners run outside React's render
  // cycle and must see the newest state, not the state they closed over.
  const cellsRef = useRef<CellState[]>(cells);
  const elapsedRef = useRef(0);
  const givensRef = useRef('');
  const activeRef = useRef(false);
  /** bumped on every edit; compared with `savedVersionRef` to know if we're dirty */
  const versionRef = useRef(0);
  const savedVersionRef = useRef(0);
  const savedElapsedRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryAttemptRef = useRef(0);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const runSaveRef = useRef<(opts: { keepalive?: boolean; force?: boolean }) => Promise<void>>(
    async () => {},
  );
  /** the filled-board signature we have already sent to /complete */
  const completionRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  const armDebounce = useCallback(() => {
    if (!activeRef.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      void runSaveRef.current({});
    }, SAVE_DEBOUNCE_MS);
  }, []);

  const performSave = useCallback(
    async (keepalive: boolean) => {
      const sentVersion = versionRef.current;
      const sentElapsed = elapsedRef.current;
      const body: SaveProgressBody = { cells: cellsRef.current, elapsedMs: sentElapsed };
      setSaveState('saving');
      try {
        const result = await saveProgress(body, { keepalive });
        if (!result.ok) {
          // 404: the server has no active game. Retrying cannot fix that.
          activeRef.current = false;
          setSaveState('failed');
          return;
        }
        retryAttemptRef.current = 0;
        if (sentVersion > savedVersionRef.current) savedVersionRef.current = sentVersion;
        savedElapsedRef.current = sentElapsed;
        if (versionRef.current === savedVersionRef.current) {
          setSaveState('saved');
        } else {
          // edits landed while the request was in flight — send the new state
          armDebounce();
        }
      } catch {
        // Nothing is lost: the edits are still in React state. Send them again.
        setSaveState('failed');
        const attempt = retryAttemptRef.current++;
        const wait = Math.min(RETRY_BASE_MS * 2 ** attempt, RETRY_MAX_MS);
        if (retryRef.current) clearTimeout(retryRef.current);
        retryRef.current = setTimeout(() => {
          retryRef.current = null;
          void runSaveRef.current({ force: true });
        }, wait);
      }
    },
    [armDebounce],
  );

  const runSave = useCallback(
    async (opts: { keepalive?: boolean; force?: boolean } = {}) => {
      if (!activeRef.current) return;
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      const mine = versionRef.current;
      const previous = inFlightRef.current;
      if (previous) await previous.catch(() => undefined);
      if (!activeRef.current) return;
      // Collapse: if the save we were waiting on already carried our edits,
      // there is nothing left to send.
      if (!opts.force && savedVersionRef.current >= mine) return;
      const run = performSave(opts.keepalive === true);
      inFlightRef.current = run;
      try {
        await run;
      } finally {
        if (inFlightRef.current === run) inFlightRef.current = null;
      }
    },
    [performSave],
  );
  runSaveRef.current = runSave;

  const adopt = useCallback((loaded: ActiveGame) => {
    const next = cellsFromGame(loaded);
    cellsRef.current = next;
    givensRef.current = loaded.givens;
    elapsedRef.current = loaded.elapsedMs;
    versionRef.current += 1;
    savedVersionRef.current = versionRef.current; // freshly loaded == already saved
    savedElapsedRef.current = loaded.elapsedMs;
    activeRef.current = true;
    completionRef.current = null;
    retryAttemptRef.current = 0;
    setGame(loaded);
    setCells(next);
    setElapsedMs(loaded.elapsedMs);
    setWrongCells(EMPTY_SET);
    setSaveState('idle');
    setCompleted(null);
    setStatus('playing');
  }, []);

  // --- load ---------------------------------------------------------------
  useEffect(() => {
    mountedRef.current = true;
    const controller = new AbortController();
    void (async () => {
      try {
        const loaded = await fetchActiveGame(controller.signal);
        if (controller.signal.aborted || !mountedRef.current) return;
        if (loaded) adopt(loaded);
        else {
          activeRef.current = false;
          setStatus('no-game');
        }
      } catch (err) {
        if (controller.signal.aborted || !mountedRef.current) return;
        setLoadError(err instanceof Error ? err.message : String(err));
        setStatus('error');
      }
    })();
    return () => {
      controller.abort();
    };
  }, [adopt]);

  useEffect(
    () => () => {
      mountedRef.current = false;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (retryRef.current) clearTimeout(retryRef.current);
    },
    [],
  );

  // --- timer --------------------------------------------------------------
  // Starts from the loaded elapsed value, and only credits time the tab was
  // actually visible for (decision 9).
  useEffect(() => {
    if (status !== 'playing') return;
    let last = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      const delta = now - last;
      last = now;
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      elapsedRef.current += delta;
      setElapsedMs(elapsedRef.current);
    }, TICK_MS);
    return () => clearInterval(id);
  }, [status]);

  // --- save on the way out ------------------------------------------------
  useEffect(() => {
    const leave = () => {
      if (!activeRef.current) return;
      const dirty = versionRef.current !== savedVersionRef.current;
      const timerMoved =
        Math.abs(elapsedRef.current - savedElapsedRef.current) >= TIMER_SAVE_THRESHOLD_MS;
      if (!dirty && !timerMoved) return;
      void runSaveRef.current({ keepalive: true, force: true });
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') leave();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', leave);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', leave);
    };
  }, []);

  // --- edits --------------------------------------------------------------
  const isGiven = useCallback((index: number) => {
    const g = givensRef.current[index];
    return g !== undefined && g !== '0';
  }, []);

  const applyEdit = useCallback(
    (update: (current: CellState[]) => CellState[] | null) => {
      if (!activeRef.current) return;
      const next = update(cellsRef.current);
      if (!next) return;
      cellsRef.current = next;
      versionRef.current += 1;
      completionRef.current = null;
      setCells(next);
      setWrongCells(EMPTY_SET);
      armDebounce();
    },
    [armDebounce],
  );

  const setValue = useCallback(
    (index: number, digit: Digit) => {
      applyEdit((current) => {
        if (isGiven(index)) return null;
        const cell = current[index];
        if (!cell || cell.value === digit) return null;
        const next = current.slice();
        // Marks survive a digit: that is how a real board looks when someone
        // fills a cell without tidying up, and it is what the awkward fixture
        // reproduces.
        next[index] = { value: digit, marks: cell.marks };
        return next;
      });
    },
    [applyEdit, isGiven],
  );

  const toggleMark = useCallback(
    (index: number, digit: number) => {
      applyEdit((current) => {
        if (isGiven(index)) return null;
        if (!Number.isInteger(digit) || digit < 1 || digit > 9) return null;
        const cell = current[index];
        if (!cell) return null;
        const marks = cell.marks.includes(digit)
          ? cell.marks.filter((d) => d !== digit)
          : [...cell.marks, digit].sort((a, b) => a - b);
        const next = current.slice();
        next[index] = { value: cell.value, marks };
        return next;
      });
    },
    [applyEdit, isGiven],
  );

  const clearCell = useCallback(
    (index: number) => {
      applyEdit((current) => {
        if (isGiven(index)) return null;
        const cell = current[index];
        if (!cell) return null;
        if (cell.value === 0 && cell.marks.length === 0) return null;
        const next = current.slice();
        next[index] = { value: 0, marks: [] };
        return next;
      });
    },
    [applyEdit, isGiven],
  );

  const flushSave = useCallback(async () => {
    await runSaveRef.current({ force: true });
  }, []);

  const startGame = useCallback(
    async (level: Level) => {
      setStatus('loading');
      setLoadError(null);
      try {
        const created = await createGame(level);
        if (created.ok) {
          adopt(created.game);
          return;
        }
        // 409: somebody (another device, another tab) already started one.
        const existing = await fetchActiveGame();
        if (existing) adopt(existing);
        else setStatus('no-game');
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : String(err));
        setStatus('error');
      }
    },
    [adopt],
  );

  const dismissCompletion = useCallback(() => {
    setCompleted(null);
    setStatus('no-game');
  }, []);

  const conflicts = useMemo(() => computeConflicts(cells), [cells]);

  // --- completion ---------------------------------------------------------
  // Full and valid (the plan's words): every cell filled and no conflict. The
  // server still owns the verdict (decision 10), so the saved state is flushed
  // first — otherwise it would judge a board older than the one on screen.
  useEffect(() => {
    if (status !== 'playing') return;
    if (cells.some((c) => c.value === 0)) return;
    if (conflicts.size > 0) return;
    const signature = cells.map((c) => c.value).join('');
    if (completionRef.current === signature) return;
    completionRef.current = signature;

    let cancelled = false;
    void (async () => {
      await runSaveRef.current({ force: true });
      if (cancelled) return;
      try {
        const result = await completeGame();
        if (cancelled) return;
        if (result.ok) {
          activeRef.current = false;
          setCompleted(result.entry);
          setGame(null);
          setStatus('completed');
        } else if (result.error === 'not-solved') {
          setWrongCells(new Set(result.wrongCells));
        } else {
          activeRef.current = false;
          setStatus('no-game');
        }
      } catch {
        // A transport failure here is not a verdict; let the user try again by
        // touching the board.
        completionRef.current = null;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cells, conflicts, status]);

  return {
    status,
    game,
    givens: game?.givens ?? '',
    cells,
    elapsedMs,
    saveState,
    conflicts,
    wrongCells,
    completed,
    loadError,
    isGiven,
    setValue,
    toggleMark,
    clearCell,
    startGame,
    dismissCompletion,
    flushSave,
  };
}
