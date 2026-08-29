import { expect, it } from 'vitest';
import { countSolutions, generate, rate } from './index.js';
import { LEVELS } from './types.js';

// Pin: the whole point of the library, in one test.
//
// Written 2026-08-29 (WP-A) against `NotImplemented` stubs and marked
// `it.fails` so the tree could document a known gap without CI going red.
// Green as of WP-D (techniques 1-10 + level targeting) and flipped to a plain
// `it` here in WP-D2 — all six levels now generate and rate.
//
// What it guards, per level, for the fixed seed 1:
//   - `generate` returns a puzzle at all (decision 4: six levels, all reachable)
//   - the puzzle has exactly one solution (decision 5)
//   - `rate` does not stall — the ladder solves it end to end and lands the
//     score in the band that was asked for (a `null` here means some technique
//     the puzzle needs is missing from `LADDER`)
//   - generation is deterministic: the same seed gives byte-identical givens
//     (decision 3)
// If this goes red, one of those four properties broke; the trace from
// `rate(p.givens)` names the technique that stopped firing.
it('generates a uniquely-solvable puzzle at every level, deterministically', () => {
  for (const level of LEVELS) {
    // all six, decision 4
    const p = generate({ level, seed: 1 });
    expect(countSolutions(p.givens, 2)).toBe(1); // decision 5
    expect(rate(p.givens)?.level).toBe(level); // rate() is null if the ladder stalls
    expect(generate({ level, seed: 1 }).givens).toEqual(p.givens); // decision 3
  }
});
