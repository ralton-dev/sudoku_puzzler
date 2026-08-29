/**
 * The practise flow for one example: pick the pattern, then pick what it does.
 *
 * Two stages, because that is how the technique is actually used. Seeing the
 * pattern and knowing what it rules out are separate skills, and a single
 * "click everything then submit" would let a learner be right by accident and
 * would make the feedback useless. So the hook checks the pattern first, and
 * only then asks for the eliminations (or the placement).
 *
 * ## Shapes are not assumed
 *
 * Nothing here knows how big a pattern is or what units it lives in. That is
 * not tidiness — `forcingChains` produces a `Step` whose `cells` is a chain of
 * variable length (start square first, forced square last) with `units: []`, so
 * any code that assumed "four corners" or "a unit to name" would be wrong on
 * rung 11. The answer is always exactly `step.cells`, and the result is always
 * exactly `step.eliminations` plus `step.placements`, whatever their sizes.
 *
 * ## Feedback is partial on purpose
 *
 * A wrong answer names the picks that *were* right and says how many are still
 * missing, without naming them: enough to tell a learner they are looking in
 * the right region, not enough to hand them the answer. Naming the misses would
 * turn the second attempt into typing practice.
 *
 * The hook keeps no state across examples. The page renders one `<Practice>`
 * per example with a `key`, so moving to the next example remounts and the
 * stage, the picks and the feedback all start clean.
 */

import { useCallback, useMemo, useState } from 'react';
import type { Step } from 'sudoku-core';
import { cellLabel, markKey } from './CandidateBoard';

export type PracticeStage = 'pattern' | 'result' | 'solved';

/** What the learner is asked to produce at the result stage. */
export type Wants = 'placement' | 'elimination';

export interface CheckResult {
  correct: boolean;
  /** picks that belong to the answer, as display labels */
  matched: string[];
  /** answer parts not picked, as display labels */
  missing: string[];
  /** picks that do not belong to the answer, as display labels */
  extra: string[];
}

export interface Feedback extends CheckResult {
  stage: 'pattern' | 'result';
  message: string;
}

/** The squares that make up the pattern — `step.cells`, whatever its length. */
export function expectedPattern(step: Step): Set<number> {
  return new Set(step.cells);
}

/**
 * What the step does, as `markKey` values: every eliminated candidate and every
 * placed digit. Both are a click on a digit inside a square, so both are
 * checked the same way; which of the two a technique produces is `wantsOf`.
 */
export function expectedResult(step: Step): Set<string> {
  const keys = new Set<string>();
  for (const { cell, digits } of step.eliminations) {
    for (const digit of digits) keys.add(markKey(cell, digit));
  }
  for (const { cell, digit } of step.placements) keys.add(markKey(cell, digit));
  return keys;
}

/** A step either fills a square or rubs candidates out; the prompt differs. */
export function wantsOf(step: Step): Wants {
  return step.placements.length > 0 ? 'placement' : 'elimination';
}

/** `7 in r3c8` — how a candidate pick reads back to the learner. */
export function markLabel(key: string): string {
  const [cell, digit] = key.split(':');
  return `${digit} in ${cellLabel(Number(cell))}`;
}

function compare<T>(
  expected: ReadonlySet<T>,
  picked: ReadonlySet<T>,
  label: (value: T) => string,
): CheckResult {
  const matched: string[] = [];
  const missing: string[] = [];
  const extra: string[] = [];
  for (const value of expected) (picked.has(value) ? matched : missing).push(label(value));
  for (const value of picked) if (!expected.has(value)) extra.push(label(value));
  return { correct: missing.length === 0 && extra.length === 0, matched, missing, extra };
}

/** Are these the pattern squares? */
export function checkPattern(step: Step, picked: ReadonlySet<number>): CheckResult {
  return compare(expectedPattern(step), picked, cellLabel);
}

/** Are these the candidates the step removes (or the digit it places)? */
export function checkResult(step: Step, picked: ReadonlySet<string>): CheckResult {
  return compare(expectedResult(step), picked, markLabel);
}

function list(labels: readonly string[]): string {
  if (labels.length <= 1) return labels[0] ?? '';
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1] as string}`;
}

function patternMessage(result: CheckResult, total: number): string {
  if (result.correct) return 'That is the pattern.';
  const parts: string[] = [];
  if (result.matched.length === 0) {
    parts.push(`None of those are pattern squares — there are ${total} to find.`);
  } else {
    parts.push(
      `${list(result.matched)} ${result.matched.length === 1 ? 'is' : 'are'} part of the pattern.`,
    );
    if (result.missing.length > 0) {
      parts.push(`${result.missing.length} more to find.`);
    }
  }
  if (result.extra.length > 0) {
    parts.push(`${list(result.extra)} ${result.extra.length === 1 ? 'is' : 'are'} not.`);
  }
  return parts.join(' ');
}

function resultMessage(result: CheckResult, wants: Wants): string {
  if (result.correct) return 'Correct.';
  const noun = wants === 'placement' ? 'placement' : 'elimination';
  const parts: string[] = [];
  if (result.matched.length === 0) {
    parts.push(`Not this one — the step makes ${result.missing.length} ${noun}${result.missing.length === 1 ? '' : 's'}.`);
  } else {
    parts.push(`${list(result.matched)} — right.`);
    if (result.missing.length > 0) parts.push(`${result.missing.length} more.`);
  }
  if (result.extra.length > 0) {
    parts.push(`${list(result.extra)} ${result.extra.length === 1 ? 'is' : 'are'} not removed here.`);
  }
  return parts.join(' ');
}

export interface Practice {
  stage: PracticeStage;
  wants: Wants;
  pickedCells: ReadonlySet<number>;
  pickedMarks: ReadonlySet<string>;
  feedback: Feedback | null;
  attempts: number;
  /** true once the learner has asked to be shown the answer */
  revealed: boolean;
  toggleCell: (cell: number) => void;
  toggleMark: (cell: number, digit: number) => void;
  submit: () => void;
  reveal: () => void;
  reset: () => void;
}

/**
 * Drive one practise example. `step` is the answer; the hook never sees the
 * board, and the board never sees the answer.
 */
export function usePractice(step: Step): Practice {
  const [stage, setStage] = useState<PracticeStage>('pattern');
  const [pickedCells, setPickedCells] = useState<ReadonlySet<number>>(() => new Set<number>());
  const [pickedMarks, setPickedMarks] = useState<ReadonlySet<string>>(() => new Set<string>());
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const wants = useMemo(() => wantsOf(step), [step]);

  const toggleCell = useCallback((cell: number) => {
    setPickedCells((current) => {
      const next = new Set(current);
      if (!next.delete(cell)) next.add(cell);
      return next;
    });
  }, []);

  const toggleMark = useCallback((cell: number, digit: number) => {
    setPickedMarks((current) => {
      const next = new Set(current);
      const key = markKey(cell, digit);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }, []);

  const submit = useCallback(() => {
    setAttempts((n) => n + 1);
    if (stage === 'pattern') {
      const result = checkPattern(step, pickedCells);
      setFeedback({
        ...result,
        stage: 'pattern',
        message: patternMessage(result, step.cells.length),
      });
      if (result.correct) setStage('result');
      return;
    }
    if (stage === 'result') {
      const result = checkResult(step, pickedMarks);
      setFeedback({ ...result, stage: 'result', message: resultMessage(result, wants) });
      if (result.correct) setStage('solved');
    }
  }, [pickedCells, pickedMarks, stage, step, wants]);

  const reveal = useCallback(() => {
    setRevealed(true);
    setFeedback(null);
  }, []);

  const reset = useCallback(() => {
    setStage('pattern');
    setPickedCells(new Set<number>());
    setPickedMarks(new Set<string>());
    setFeedback(null);
    setAttempts(0);
    setRevealed(false);
  }, []);

  return {
    stage,
    wants,
    pickedCells,
    pickedMarks,
    feedback,
    attempts,
    revealed,
    toggleCell,
    toggleMark,
    submit,
    reveal,
    reset,
  };
}
