/**
 * The ladder, top to bottom: fourteen techniques in the order the rater tries
 * them, which is also the order they are worth learning in.
 *
 * The list is driven by `TECHNIQUE_IDS` from the core library rather than by
 * what `examples.json` happens to contain, so a technique with no mined
 * position still gets a page (decision 16's fourteen are the ladder; two of
 * them are explain-only, and the entry says so rather than vanishing).
 *
 * The tick is per-browser `localStorage` (see `progress.ts`) and is read once
 * on mount. Nothing here talks to the server: training is read-only with
 * respect to the game (decision 18).
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TECHNIQUE_IDS, TECHNIQUE_META, type TechniqueId, examplesFor } from 'sudoku-core';
import { SUMMARIES } from './content';
import { clearDone, readDone } from './progress';

export function TrainingIndex() {
  const [done, setDone] = useState<ReadonlySet<TechniqueId>>(() => new Set<TechniqueId>());

  // Read after mount rather than in the initial state: the value is per-browser
  // and irrelevant to the markup's correctness, and reading storage during
  // render is the kind of thing that bites in a non-browser environment.
  useEffect(() => setDone(readDone()), []);

  return (
    <section className="tr-index">
      <h2>Training</h2>
      <p className="tr-lede">
        The fourteen techniques our solver uses, cheapest first — the same ladder that scores a
        puzzle&rsquo;s difficulty. Each page explains the technique in our own words, demonstrates it
        on a position taken from a real generated puzzle, and then asks you to find it yourself. The
        definitions follow{' '}
        <a
          href="https://www.sudokuoftheday.com/techniques"
          target="_blank"
          rel="noreferrer noopener"
        >
          sudokuoftheday.com/techniques
        </a>
        .
      </p>
      <ol className="tr-list" data-testid="technique-list">
        {TECHNIQUE_IDS.map((id, index) => {
          const meta = TECHNIQUE_META[id];
          const count = examplesFor(id).length;
          return (
            <li key={id} className="tr-item" data-technique={id}>
              <Link to={`/training/${id}`} className="tr-link">
                <span className="tr-rung">{index + 1}</span>
                <span className="tr-body">
                  <span className="tr-name">
                    {meta.name}
                    {meta.sotdName === meta.name ? null : (
                      <span className="tr-alias"> · {meta.sotdName}</span>
                    )}
                    {done.has(id) ? (
                      <span className="tr-done" title="practised" aria-label="practised">
                        ✓
                      </span>
                    ) : null}
                  </span>
                  <span className="tr-summary">{SUMMARIES[id]}</span>
                  <span className="tr-meta">
                    <span className="tr-cost">
                      {meta.cost[0]} / {meta.cost[1]}
                    </span>
                    <span className="tr-count">
                      {count === 0
                        ? 'explanation only'
                        : count === 1
                          ? '1 example'
                          : `${count} examples`}
                    </span>
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
      <p className="tr-foot">
        Cost is decision 16&rsquo;s score for the technique: what it adds the first time a puzzle
        needs it, then every time after.{' '}
        {done.size > 0 ? (
          <button
            type="button"
            className="tr-reset"
            onClick={() => {
              clearDone();
              setDone(new Set<TechniqueId>());
            }}
          >
            Clear my ticks
          </button>
        ) : null}
      </p>
    </section>
  );
}
