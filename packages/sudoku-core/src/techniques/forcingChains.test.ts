import { describe, expect, it } from 'vitest';
import { KNOWN_BY_LEVEL } from '../fixtures/known.js';
import { candidates, digitsOf, parseGrid, popcount } from '../grid.js';
import { MAX_CHAIN_DEPTH, forcingChains } from './forcingChains.js';
import { COSTS, LADDER, TECHNIQUES } from './index.js';
import { type TechniqueState, applyStep, createState } from './state.js';
import { blank, only } from './sculpt.js';

/**
 * Forcing chains only ever runs on a position the cheap end of the ladder has
 * given up on, and such a position cannot be sculpted out of a blank board the
 * way a naked pair can — the whole technique is about implications, and a blank
 * board implies nothing. So the positive case is a real one: the diabolical
 * fixture, driven with techniques 1..10 until they stall. That is exactly the
 * position `rate()` reaches, and before WP-D2 it was where `rate()` returned
 * `null`.
 */
function stalled(givens: string): TechniqueState {
  const state = createState(parseGrid(givens));
  const cheaper = LADDER.filter((id) => COSTS[id][0] < COSTS.forcingChains[0]);
  for (;;) {
    const step = cheaper.map((id) => TECHNIQUES[id](state)).find((s) => s !== null);
    if (step === undefined || step === null) return state;
    applyStep(state, step);
  }
}

describe('forcingChains', () => {
  it('places the digit both branches agree on, on the stalled diabolical fixture', () => {
    const fixture = KNOWN_BY_LEVEL.diabolical;
    const state = stalled(fixture.givens);
    const step = forcingChains(state);

    expect(step).toMatchObject({
      technique: 'forcingChains',
      units: [], // a chain is not confined to a unit — see the file header
      eliminations: [],
      placements: [{ cell: 4, digit: 7 }],
    });
    // and the placement is the truth, not merely a consistent guess
    expect(fixture.solution[4]).toBe('7');

    // cells is the chain: start cell first, forced cell last, links between
    const cells = step?.cells as number[];
    expect(cells.length).toBeGreaterThanOrEqual(2);
    expect(cells[0]).toBe(27); // r4c1, the bivalue cell the chain starts at
    expect(cells[cells.length - 1]).toBe(4); // r1c5, the cell it forces
    expect(new Set(cells).size).toBe(cells.length); // no cell listed twice

    expect(step?.reason).toContain('r4c1 is either 6 or 9');
    expect(step?.reason).toContain('Whichever way r4c1 goes, r1c5 is 7');
    expect(applyStep(state, step!)).toBeGreaterThan(0);
  });

  it('skips earlier bivalue cells that force nothing, taking the first that does', () => {
    const state = stalled(KNOWN_BY_LEVEL.diabolical.givens);
    const start = (forcingChains(state)?.cells as number[])[0] as number;
    expect(start).toBe(27);

    // There are nine bivalue cells *before* r4c1 in this position. The scan is
    // ascending, so every one of them was tried and abandoned: two candidates
    // are the entry ticket, not the answer.
    const earlier: number[] = [];
    for (let cell = 0; cell < start; cell++) {
      if ((state.grid[cell] as number) !== 0) continue;
      if (popcount(state.cand[cell] as number) === 2) earlier.push(cell);
    }
    expect(earlier).toEqual([4, 6, 8, 14, 17, 22, 23, 24, 26]);
  });

  it('returns the identical step from a rebuilt position (the WP-T1 contract)', () => {
    const first = stalled(KNOWN_BY_LEVEL.diabolical.givens);
    const step = forcingChains(first);
    const rebuilt = createState(
      Uint8Array.from(first.grid),
      [...first.cand].flatMap((mask, cell) =>
        first.grid[cell] === 0
          ? [{ cell, digits: digitsOf(candidates(first.grid, cell) & ~mask) }]
          : [],
      ),
    );
    expect(forcingChains(rebuilt)).toEqual(step);
  });

  it('finds nothing on an untouched board — no cell has two candidates', () => {
    expect(forcingChains(blank())).toBeNull();
  });

  it('finds nothing when the two branches imply nothing to agree on', () => {
    // One bivalue cell on an otherwise empty board: filling it fires no single,
    // so both chains are empty and there is nothing for them to agree on.
    expect(forcingChains(only(blank(), 0, [1, 2]))).toBeNull();
  });

  it('bounds a branch at a chain length a person could still follow', () => {
    // The bound is not a pure "find less" knob — see the file header, and
    // `calibration.test.ts`, which pins it against the six fixture scores.
    expect(MAX_CHAIN_DEPTH).toBe(12);
  });
});
