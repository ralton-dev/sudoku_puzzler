/**
 * Which techniques the learner has practised, remembered in `localStorage`.
 *
 * This is the only state the training section keeps, and it is deliberately
 * per-browser rather than server-side: training is read-only with respect to
 * the game (decision 18), so a tick here must never become a row, a route or a
 * reason for the client to write to the API.
 *
 * Every access is wrapped. `localStorage` is not merely absent in some
 * environments — reading it *throws* in a browser with site data blocked, and
 * writing throws when the quota is full or the tab is in a private window with
 * storage disabled. A training page that crashed for that reason would take the
 * whole app down with it, so a failure here degrades to "nothing is ticked".
 */

import { TECHNIQUE_IDS, type TechniqueId } from 'sudoku-core';

const KEY = 'sudoku-puzzler.training.done';

const IDS: ReadonlySet<string> = new Set<string>(TECHNIQUE_IDS);

/** The techniques marked done, ignoring anything unrecognised in storage. */
export function readDone(): Set<TechniqueId> {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw === null) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is TechniqueId => typeof id === 'string' && IDS.has(id)));
  } catch {
    return new Set();
  }
}

/** Add `technique` to the done set and return the new set. */
export function markDone(technique: TechniqueId): Set<TechniqueId> {
  const done = readDone();
  done.add(technique);
  try {
    window.localStorage.setItem(KEY, JSON.stringify([...done]));
  } catch {
    // The tick is a convenience, not a promise. Losing it is not an error the
    // learner needs to be told about.
  }
  return done;
}

/** Forget every tick. Used by the index's "reset" control and by tests. */
export function clearDone(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // as above
  }
}
