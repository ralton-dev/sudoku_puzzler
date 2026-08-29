import { expect, it } from 'vitest';
import { countSolutions, generate, rate } from './index.js';
import { LEVELS } from './types.js';

// Pin: the whole point of the library, in one test.
//
// Written 2026-08-29 (WP-A) before any implementation existed; all three
// functions are `NotImplemented` stubs, so this throws on the first line of the
// loop. `it.fails` records that as the expected state: CI stays green and the
// tree documents that the gap is known.
//
// WP-D2 flips this to a plain `it(...)` as part of its acceptance. If it ever
// starts *passing* while still marked `.fails`, vitest fails the run — which is
// exactly the alarm we want.
it.fails('generates a uniquely-solvable puzzle at every level, deterministically', () => {
  for (const level of LEVELS) {
    // all six, decision 4
    const p = generate({ level, seed: 1 });
    expect(countSolutions(p.givens, 2)).toBe(1); // decision 5
    expect(rate(p.givens)?.level).toBe(level); // rate() is null if the ladder stalls
    expect(generate({ level, seed: 1 }).givens).toEqual(p.givens); // decision 3
  }
});
