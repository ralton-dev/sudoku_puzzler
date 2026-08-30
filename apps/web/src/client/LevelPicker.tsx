/**
 * The six levels of decision 4, in the order the core library declares them.
 * The names are the contract's own strings — no display-name mapping, so a
 * seventh level could never appear here without appearing in `LEVELS` first.
 *
 * The order is information — it is a ladder — so each card carries a
 * six-segment rung bar with its own rung inked (`.ladder` in `styles.css`).
 * The bar is `aria-hidden` and **last in the DOM**: the button's accessible
 * name has to stay "medium pairs start to matter", because the e2e picks a
 * level by `/^medium/` and anything rendered ahead of the name would land in
 * front of it.
 *
 * The list is an `<ol>` rather than a `<ul>` for the same reason: six things
 * in an order that means something.
 */

import { LEVELS, type Level } from 'sudoku-core';
import type { CSSProperties } from 'react';

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
      <ol className="level-list">
        {LEVELS.map((level, index) => (
          <li key={level}>
            <button
              type="button"
              className="level-button"
              disabled={busy}
              onClick={() => onPick(level)}
            >
              <span className="level-name">{level}</span>
              <span className="level-blurb">{BLURB[level]}</span>
              <span
                className="ladder"
                aria-hidden="true"
                style={{ '--rung': index + 1, '--rungs': LEVELS.length } as CSSProperties}
              />
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
