/**
 * The six levels of decision 4, in the order the core library declares them.
 * The names are the contract's own strings — no display-name mapping, so a
 * seventh level could never appear here without appearing in `LEVELS` first.
 */

import { LEVELS, type Level } from 'sudoku-core';

const BLURB: Record<Level, string> = {
  beginner: 'singles only',
  easy: 'singles and candidate lines',
  medium: 'pairs start to matter',
  tricky: 'triples and hidden pairs',
  fiendish: 'X-wings and forcing chains',
  diabolical: 'everything, including swordfish',
};

export interface LevelPickerProps {
  onPick: (level: Level) => void;
  busy: boolean;
  heading?: string;
}

export function LevelPicker({ onPick, busy, heading = 'Start a puzzle' }: LevelPickerProps) {
  return (
    <section className="level-picker" aria-label="choose a level">
      <h2>{heading}</h2>
      <ul className="level-list">
        {LEVELS.map((level) => (
          <li key={level}>
            <button
              type="button"
              className="level-button"
              disabled={busy}
              onClick={() => onPick(level)}
            >
              <span className="level-name">{level}</span>
              <span className="level-blurb">{BLURB[level]}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
