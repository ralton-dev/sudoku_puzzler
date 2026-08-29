/**
 * The elapsed clock. Ticking lives in `useGame` — `elapsedMs` is part of every
 * save, so the value and the thing that saves it stay together — and this
 * component only formats it.
 *
 * It must read correctly for a puzzle that has been open for hours, because
 * that is the normal case for a board resumed from the server: the hour field
 * appears as soon as it is non-zero and never as a bare "62:03".
 */

export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

export function Timer({ elapsedMs }: { elapsedMs: number }) {
  return (
    <time className="timer" aria-label="elapsed time" data-testid="timer">
      {formatElapsed(elapsedMs)}
    </time>
  );
}
