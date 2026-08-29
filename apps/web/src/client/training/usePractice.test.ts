/**
 * The practise state machine, against two fixture steps that between them cover
 * the two shapes the ladder actually produces.
 *
 * `XWING` is the ordinary case: a fixed four-square pattern and an elimination.
 * `CHAIN` is the one that breaks assumptions — `forcingChains` returns a
 * variable-length chain of cells (start first, forced last), an empty `units`,
 * a placement and no eliminations. Every test below that says "pattern" runs
 * against both, because a hook that only handles four corners is a hook that
 * fails on rung 11.
 */

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Step } from 'sudoku-core';
import { checkPattern, checkResult, usePractice, wantsOf } from './usePractice';

/** A real X-Wing step, copied from `training/examples.json`. */
const XWING: Step = {
  technique: 'xWing',
  cells: [18, 25, 45, 52],
  units: [2, 5, 9, 16],
  placements: [],
  eliminations: [{ cell: 9, digits: [3] }],
  reason: 'The 3 of row 3 and of row 6 each have only two places…',
};

/** A forcing chain: five links, one placement, no units, no eliminations. */
const CHAIN: Step = {
  technique: 'forcingChains',
  cells: [38, 40, 22, 13, 9],
  units: [],
  placements: [{ cell: 9, digit: 5 }],
  eliminations: [],
  reason: 'Whichever way r5c3 goes, r2c1 is 5.',
};

describe('checkPattern', () => {
  it('accepts exactly the step cells, in any order', () => {
    expect(checkPattern(XWING, new Set([52, 18, 45, 25])).correct).toBe(true);
    expect(checkPattern(CHAIN, new Set([9, 13, 22, 38, 40])).correct).toBe(true);
  });

  it('reports the matched squares and the count still missing, without naming them', () => {
    const result = checkPattern(XWING, new Set([18, 25]));
    expect(result.correct).toBe(false);
    expect(result.matched).toEqual(['r3c1', 'r3c8']);
    expect(result.missing).toEqual(['r6c1', 'r6c8']);
    expect(result.extra).toEqual([]);
  });

  it('reports picks that are not part of the pattern', () => {
    const result = checkPattern(XWING, new Set([18, 25, 45, 52, 80]));
    expect(result.correct).toBe(false);
    expect(result.matched).toHaveLength(4);
    expect(result.extra).toEqual(['r9c9']);
  });

  it('does not care how long the pattern is', () => {
    // Four of the chain's five links: partial, not wrong-shaped.
    const result = checkPattern(CHAIN, new Set([38, 40, 22, 13]));
    expect(result.correct).toBe(false);
    expect(result.matched).toHaveLength(4);
    expect(result.missing).toEqual(['r2c1']);
  });
});

describe('checkResult', () => {
  it('matches an elimination by cell and digit', () => {
    expect(checkResult(XWING, new Set(['9:3'])).correct).toBe(true);
    expect(checkResult(XWING, new Set(['9:4'])).matched).toEqual([]);
    expect(checkResult(XWING, new Set(['9:4'])).extra).toEqual(['4 in r2c1']);
  });

  it('matches a placement the same way', () => {
    expect(wantsOf(CHAIN)).toBe('placement');
    expect(wantsOf(XWING)).toBe('elimination');
    expect(checkResult(CHAIN, new Set(['9:5'])).correct).toBe(true);
    expect(checkResult(CHAIN, new Set(['9:2'])).correct).toBe(false);
  });
});

describe('usePractice', () => {
  it('holds at the pattern stage until the pattern is right', () => {
    const { result } = renderHook(() => usePractice(XWING));

    expect(result.current.stage).toBe('pattern');

    act(() => result.current.toggleCell(18));
    act(() => result.current.submit());

    expect(result.current.stage).toBe('pattern');
    expect(result.current.feedback?.correct).toBe(false);
    expect(result.current.feedback?.message).toContain('r3c1 is part of the pattern');
    expect(result.current.feedback?.message).toContain('3 more to find');
    // The misses are counted, never named — otherwise the second attempt is
    // typing practice rather than practice.
    expect(result.current.feedback?.message).not.toContain('r3c8');

    act(() => {
      result.current.toggleCell(25);
      result.current.toggleCell(45);
      result.current.toggleCell(52);
    });
    act(() => result.current.submit());

    expect(result.current.stage).toBe('result');
    expect(result.current.feedback?.correct).toBe(true);
  });

  it('names the wrong picks and stays put when the result is wrong', () => {
    const { result } = renderHook(() => usePractice(XWING));

    act(() => {
      for (const cell of XWING.cells) result.current.toggleCell(cell);
    });
    act(() => result.current.submit());
    expect(result.current.stage).toBe('result');

    act(() => result.current.toggleMark(9, 4));
    act(() => result.current.submit());

    expect(result.current.stage).toBe('result');
    expect(result.current.feedback?.message).toContain('4 in r2c1');
    expect(result.current.feedback?.correct).toBe(false);

    act(() => {
      result.current.toggleMark(9, 4); // un-pick the wrong one
      result.current.toggleMark(9, 3);
    });
    act(() => result.current.submit());

    expect(result.current.stage).toBe('solved');
    expect(result.current.feedback?.message).toBe('Correct.');
    expect(result.current.attempts).toBe(3);
  });

  it('solves a forcing chain, whose pattern is a chain and whose result is a placement', () => {
    const { result } = renderHook(() => usePractice(CHAIN));

    expect(result.current.wants).toBe('placement');

    act(() => {
      for (const cell of CHAIN.cells) result.current.toggleCell(cell);
    });
    act(() => result.current.submit());
    expect(result.current.stage).toBe('result');

    act(() => result.current.toggleMark(9, 5));
    act(() => result.current.submit());
    expect(result.current.stage).toBe('solved');
  });

  it('toggles a pick off again, and resets to a clean slate', () => {
    const { result } = renderHook(() => usePractice(XWING));

    act(() => result.current.toggleCell(18));
    act(() => result.current.toggleCell(18));
    expect(result.current.pickedCells.size).toBe(0);

    act(() => result.current.toggleCell(80));
    act(() => result.current.submit());
    expect(result.current.feedback).not.toBeNull();

    act(() => result.current.reset());
    expect(result.current.stage).toBe('pattern');
    expect(result.current.pickedCells.size).toBe(0);
    expect(result.current.feedback).toBeNull();
    expect(result.current.attempts).toBe(0);
  });

  it('revealing the answer does not count as solving it', () => {
    const { result } = renderHook(() => usePractice(XWING));

    act(() => result.current.reveal());

    expect(result.current.revealed).toBe(true);
    expect(result.current.stage).toBe('pattern');
    expect(result.current.feedback).toBeNull();
  });
});
