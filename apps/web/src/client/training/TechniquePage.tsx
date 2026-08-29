/**
 * One technique: explain it, demonstrate it, then make the learner find it.
 *
 * The three tabs are the plan's three stages, and the split is not cosmetic —
 * "Show me" walks the answer, "Practise" withholds it, and they must not be
 * able to leak into each other, so they hold separate state and separate
 * boards.
 *
 * ## Where the position comes from
 *
 * `TRAINING_EXAMPLES` (decision 18) stores a position as `{grid, eliminated}`,
 * and `createState(parseGrid(grid), eliminated)` rebuilds the exact candidate
 * state the step was found in — naive candidates, minus what the cheaper steps
 * before it had already ruled out. That replay matters: the technique fires on
 * this position *because* those eliminations are in place, so a board drawn
 * with naive candidates would show a pattern that is not there.
 *
 * It is pure library code, called in the browser. There is no training API and
 * no server route, and this page never touches the active game: the game hook
 * lives above the router outlet in `App.tsx` and keeps ticking and saving while
 * this page is on screen, which is exactly what it should do and exactly what
 * this page must not interfere with.
 *
 * ## Techniques with no position
 *
 * `nakedQuad` and `hiddenQuad` have no mined examples and are explain-only. The
 * cause is structural rather than a shortage of mining (a quad's complement in
 * a unit is a cheaper pair or triple, which the ladder takes first), so the
 * page says so plainly instead of pretending the tabs are coming later. A
 * technique with exactly one example gets Explain and Show me, and says why
 * there is nothing to practise.
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  TECHNIQUE_IDS,
  TECHNIQUE_META,
  createState,
  examplesFor,
  parseGrid,
  type TechniqueId,
  type TrainingExample,
} from 'sudoku-core';
import { CandidateBoard, markKey } from './CandidateBoard';
import { PROSE, SUMMARIES } from './content';
import { Prose } from './Prose';
import { markDone, readDone } from './progress';
import { usePractice } from './usePractice';

type Tab = 'explain' | 'show' | 'practise';

const IDS: ReadonlySet<string> = new Set<string>(TECHNIQUE_IDS);

function isTechniqueId(value: string | undefined): value is TechniqueId {
  return value !== undefined && IDS.has(value);
}

/** The candidate state a stored example was found in. */
function stateOf(example: TrainingExample) {
  return createState(parseGrid(example.grid), example.eliminated);
}

function struckOf(example: TrainingExample): Set<string> {
  const keys = new Set<string>();
  for (const { cell, digits } of example.step.eliminations) {
    for (const digit of digits) keys.add(markKey(cell, digit));
  }
  return keys;
}

function placedOf(example: TrainingExample): Map<number, number> {
  return new Map(example.step.placements.map(({ cell, digit }) => [cell, digit]));
}

export function TechniquePage() {
  const { technique } = useParams<{ technique: string }>();
  if (!isTechniqueId(technique)) {
    return (
      <section className="tr-page">
        <p className="notice notice-bad">There is no technique called &ldquo;{technique}&rdquo;.</p>
        <p>
          <Link to="/training">Back to the ladder</Link>
        </p>
      </section>
    );
  }
  return <Technique id={technique} />;
}

function Technique({ id }: { id: TechniqueId }) {
  const meta = TECHNIQUE_META[id];
  const examples = useMemo(() => examplesFor(id), [id]);
  const [tab, setTab] = useState<Tab>('explain');
  const [done, setDone] = useState(false);

  useEffect(() => {
    setTab('explain');
    setDone(readDone().has(id));
  }, [id]);

  const onSolved = useCallback(() => {
    markDone(id);
    setDone(true);
  }, [id]);

  const canShow = examples.length >= 1;
  const canPractise = examples.length >= 2;

  return (
    <section className="tr-page">
      <p className="tr-crumb">
        <Link to="/training">← All techniques</Link>
      </p>
      <h2>
        {meta.name}
        {done ? (
          <span className="tr-done" aria-label="practised">
            ✓
          </span>
        ) : null}
      </h2>
      <p className="tr-subhead">
        Rung {TECHNIQUE_IDS.indexOf(id) + 1} of 14 · sudokuoftheday.com calls it{' '}
        <em>{meta.sotdName}</em> · costs {meta.cost[0]} first, {meta.cost[1]} after that
      </p>
      <p className="tr-summary-line">{SUMMARIES[id]}</p>

      <div className="tr-tabs" role="tablist" aria-label={`${meta.name} sections`}>
        <TabButton current={tab} value="explain" onSelect={setTab}>
          Explain
        </TabButton>
        {canShow ? (
          <TabButton current={tab} value="show" onSelect={setTab}>
            Show me
          </TabButton>
        ) : null}
        {canPractise ? (
          <TabButton current={tab} value="practise" onSelect={setTab}>
            Practise
          </TabButton>
        ) : null}
      </div>

      {examples.length === 0 ? (
        <p className="notice" data-testid="no-examples">
          Explanation only. No position mined from our generator ever reaches this rung — a
          quad&rsquo;s complement in a unit is a cheaper pair or triple, which the solver takes
          first — so there is nothing honest to demonstrate or practise on.
        </p>
      ) : examples.length === 1 ? (
        <p className="notice" data-testid="one-example">
          Only one mined position for this technique, so there is a demonstration but nothing left
          over to practise on.
        </p>
      ) : null}

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'explain' ? <Prose markdown={PROSE[id]} /> : null}
        {tab === 'show' && examples[0] ? <ShowMe example={examples[0]} /> : null}
        {tab === 'practise' && canPractise ? (
          <Practise examples={examples.slice(1)} name={meta.name} onSolved={onSolved} />
        ) : null}
      </div>
    </section>
  );
}

function TabButton({
  current,
  value,
  onSelect,
  children,
}: {
  current: Tab;
  value: Tab;
  onSelect: (tab: Tab) => void;
  children: ReactNode;
}) {
  const selected = current === value;
  return (
    <button
      type="button"
      role="tab"
      id={`tab-${value}`}
      aria-selected={selected}
      aria-controls={`panel-${value}`}
      className={selected ? 'tr-tab tr-tab-on' : 'tr-tab'}
      onClick={() => onSelect(value)}
    >
      {children}
    </button>
  );
}

/** Stage 2 of the plan: the first example, walked. */
function ShowMe({ example }: { example: TrainingExample }) {
  const [stage, setStage] = useState<0 | 1 | 2>(0);
  const state = useMemo(() => stateOf(example), [example]);
  const pattern = useMemo(() => new Set(example.step.cells), [example]);
  const struck = useMemo(() => struckOf(example), [example]);
  const placed = useMemo(() => placedOf(example), [example]);

  return (
    <div className="tr-show">
      <p className="tr-instruction" data-testid="show-instruction">
        {stage === 0
          ? 'A real position from a generated puzzle, with every candidate pencilled in.'
          : stage === 1
            ? 'The pattern is highlighted.'
            : example.step.placements.length > 0
              ? 'The forced digit is filled in.'
              : 'The candidates it rules out are struck through.'}
      </p>
      <CandidateBoard
        grid={state.grid}
        cand={state.cand}
        pattern={stage >= 1 ? pattern : undefined}
        struck={stage >= 2 ? struck : undefined}
        placed={stage >= 2 ? placed : undefined}
        label="worked example"
      />
      {stage >= 1 ? (
        <p className="tr-reason" data-testid="show-reason">
          {example.step.reason}
        </p>
      ) : null}
      <div className="tr-controls">
        {stage < 2 ? (
          <button type="button" className="tr-button" onClick={() => setStage(stage === 0 ? 1 : 2)}>
            {stage === 0 ? 'Show the pattern' : 'Show the result'}
          </button>
        ) : (
          <button type="button" className="tr-button" onClick={() => setStage(0)}>
            Start over
          </button>
        )}
      </div>
    </div>
  );
}

/** Stage 3: the remaining examples, with the answer withheld. */
function Practise({
  examples,
  name,
  onSolved,
}: {
  examples: readonly TrainingExample[];
  name: string;
  onSolved: () => void;
}) {
  const [index, setIndex] = useState(0);
  const example = examples[Math.min(index, examples.length - 1)];
  if (!example) return null;
  return (
    <div className="tr-practise">
      <p className="tr-instruction">
        Position {index + 1} of {examples.length}.
      </p>
      <PractiseOne
        key={index}
        example={example}
        name={name}
        onSolved={onSolved}
        onNext={index + 1 < examples.length ? () => setIndex(index + 1) : undefined}
      />
    </div>
  );
}

function PractiseOne({
  example,
  name,
  onSolved,
  onNext,
}: {
  example: TrainingExample;
  name: string;
  onSolved: () => void;
  onNext?: (() => void) | undefined;
}) {
  const state = useMemo(() => stateOf(example), [example]);
  const pattern = useMemo(() => new Set(example.step.cells), [example]);
  const struck = useMemo(() => struckOf(example), [example]);
  const placed = useMemo(() => placedOf(example), [example]);
  const practice = usePractice(example.step);
  const { stage, revealed } = practice;

  useEffect(() => {
    if (stage === 'solved') onSolved();
  }, [stage, onSolved]);

  const showAnswer = stage === 'solved' || revealed;
  const prompt =
    stage === 'pattern'
      ? `Find the ${name}: click the squares that form the pattern, then check.`
      : stage === 'result'
        ? practice.wants === 'placement'
          ? 'Right. Now click the digit that must go into the square it forces.'
          : 'Right. Now click every candidate this pattern rules out.'
        : 'Solved — that is the technique.';

  const nothingPicked =
    stage === 'pattern' ? practice.pickedCells.size === 0 : practice.pickedMarks.size === 0;

  return (
    <div className="tr-practise-one">
      <p className="tr-instruction" data-testid="practise-prompt">
        {prompt}
      </p>
      <CandidateBoard
        grid={state.grid}
        cand={state.cand}
        pattern={stage === 'pattern' && !revealed ? undefined : pattern}
        struck={showAnswer ? struck : undefined}
        placed={showAnswer ? placed : undefined}
        picking={stage === 'pattern' ? 'cells' : stage === 'result' ? 'marks' : 'none'}
        pickedCells={showAnswer ? undefined : practice.pickedCells}
        pickedMarks={showAnswer ? undefined : practice.pickedMarks}
        onPickCell={practice.toggleCell}
        onPickMark={practice.toggleMark}
        label="practise board"
      />
      {practice.feedback ? (
        <p
          className={practice.feedback.correct ? 'tr-feedback tr-good' : 'tr-feedback tr-bad'}
          data-testid="practise-feedback"
          role="status"
        >
          {practice.feedback.message}
        </p>
      ) : null}
      {showAnswer ? (
        <p className="tr-reason" data-testid="practise-reason">
          {example.step.reason}
        </p>
      ) : null}
      <div className="tr-controls">
        {stage === 'solved' ? null : (
          <button
            type="button"
            className="tr-button tr-button-primary"
            onClick={practice.submit}
            disabled={nothingPicked}
          >
            Check
          </button>
        )}
        {stage === 'solved' ? null : (
          <button type="button" className="tr-button" onClick={practice.reset}>
            Start over
          </button>
        )}
        {stage === 'solved' || revealed ? null : (
          <button type="button" className="tr-button tr-button-quiet" onClick={practice.reveal}>
            Show me the answer
          </button>
        )}
        {onNext ? (
          <button type="button" className="tr-button" onClick={onNext}>
            Next position
          </button>
        ) : null}
      </div>
      {revealed && stage !== 'solved' ? (
        <p className="notice" data-testid="practise-revealed">
          Shown, so this one does not count — try the next position, or start over.
        </p>
      ) : null}
    </div>
  );
}
