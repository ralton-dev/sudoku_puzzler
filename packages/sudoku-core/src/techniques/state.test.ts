import { describe, expect, it } from 'vitest';
import { TECHNIQUE_IDS } from '../types.js';
import { candidates, digitsOf, parseGrid } from '../grid.js';
import { KNOWN_BY_LEVEL } from '../fixtures/known.js';
import {
  applyStep,
  cellName,
  cloneState,
  createState,
  eliminate,
  hasCandidate,
  place,
  placesFor,
  stateFromString,
  unitName,
} from './state.js';
import { blank } from './sculpt.js';

describe('createState', () => {
  it('starts from the naive candidates of every empty cell, and 0 for filled ones', () => {
    const grid = parseGrid(KNOWN_BY_LEVEL.beginner.givens);
    const state = createState(grid);
    for (let i = 0; i < 81; i++) expect(state.cand[i]).toBe(candidates(grid, i));
  });

  it('does not alias the grid it was given', () => {
    const grid = parseGrid(KNOWN_BY_LEVEL.beginner.givens);
    const state = createState(grid);
    place(state, 0, 6);
    expect(grid[0]).toBe(0);
  });

  it('replays an `eliminated` ledger — this is how WP-T1 rebuilds a position', () => {
    const grid = parseGrid('0'.repeat(81));
    const eliminated = [
      { cell: 0, digits: [1, 2, 3] },
      { cell: 40, digits: [9] },
    ];
    const state = createState(grid, eliminated);
    expect(digitsOf(state.cand[0] as number)).toEqual([4, 5, 6, 7, 8, 9]);
    expect(digitsOf(state.cand[40] as number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(state.cand[1]).toBe(0x1ff);
    // and it is reproducible from the same two inputs
    expect(createState(grid, eliminated)).toEqual(state);
  });
});

describe('mutating a state', () => {
  it('place clears the cell mask and the digit from every peer', () => {
    const state = blank();
    const changed = place(state, 0, 5);
    expect(state.grid[0]).toBe(5);
    expect(state.cand[0]).toBe(0);
    expect(hasCandidate(state, 1, 5)).toBe(false);
    expect(hasCandidate(state, 9, 5)).toBe(false);
    expect(hasCandidate(state, 80, 5)).toBe(true); // not a peer
    expect(changed).toBe(21); // the placement plus 20 peers
  });

  it('eliminate counts only the candidates that were actually there', () => {
    const state = blank();
    expect(eliminate(state, 0, [1, 2])).toBe(2);
    expect(eliminate(state, 0, [1, 2])).toBe(0);
  });

  it('applyStep returns 0 for a step that changes nothing — the rater throws on that', () => {
    const state = blank();
    const noop = {
      technique: TECHNIQUE_IDS[0],
      cells: [],
      placements: [],
      eliminations: [],
      reason: 'nothing',
    };
    expect(applyStep(state, noop)).toBe(0);
  });

  it('cloneState is independent of its original', () => {
    const state = blank();
    const copy = cloneState(state);
    place(copy, 0, 1);
    expect(state.grid[0]).toBe(0);
    expect(state.cand[0]).toBe(0x1ff);
  });

  it('placesFor lists a unit’s remaining homes for a digit, ascending', () => {
    const state = stateFromString('0'.repeat(81));
    eliminate(state, 1, [7]);
    expect(placesFor(state, [0, 1, 2], 7)).toEqual([0, 2]);
  });
});

describe('learner-readable names', () => {
  it('numbers rows, columns and boxes from 1', () => {
    expect(cellName(0)).toBe('r1c1');
    expect(cellName(80)).toBe('r9c9');
    expect(unitName(0)).toBe('row 1');
    expect(unitName(9)).toBe('column 1');
    expect(unitName(26)).toBe('box 9');
  });
});
