/**
 * Completed puzzles, newest first (the server orders them; this view does not
 * re-sort, so a disagreement shows up rather than being papered over).
 *
 * Clue count is derived from `givens` — the contract carries the string for
 * exactly this reason.
 */

import { useEffect, useState } from 'react';
import type { HistoryEntry } from '../shared/api';
import { fetchHistory } from './api';
import { formatElapsed } from './Timer';

/** The column this feeds is headed "Pre-filled"; the two names are the same thing. */
function clueCount(givens: string): number {
  let n = 0;
  for (const ch of givens) if (ch !== '0') n++;
  return n;
}

function formatWhen(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return iso;
  return at.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function History() {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const rows = await fetchHistory(controller.signal);
        if (!controller.signal.aborted) setEntries(rows);
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => controller.abort();
  }, []);

  if (error) return <p className="notice notice-bad">Could not load history: {error}</p>;
  if (entries === null) return <p className="notice">Loading history…</p>;
  if (entries.length === 0) return <p className="notice">No completed puzzles yet.</p>;

  return (
    <table className="history" data-testid="history-table">
      <caption>Completed puzzles</caption>
      <thead>
        <tr>
          <th scope="col">Level</th>
          <th scope="col">Completed</th>
          <th scope="col">Time</th>
          <th scope="col" title="cells already filled when the puzzle started">
            Pre-filled
          </th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => (
          <tr key={entry.id}>
            <td className="history-level">{entry.level}</td>
            <td>{formatWhen(entry.completedAt)}</td>
            <td className="history-time">{formatElapsed(entry.elapsedMs)}</td>
            <td className="history-clues">{clueCount(entry.givens)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
