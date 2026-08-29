import { describe, expect, it } from 'vitest';
import { TECHNIQUE_IDS } from '../types.js';
import { COSTS, LADDER, TECHNIQUES } from './index.js';

describe('the ladder', () => {
  it('costs all fourteen techniques of decision 16', () => {
    expect(Object.keys(COSTS).sort()).toEqual([...TECHNIQUE_IDS].sort());
    for (const id of TECHNIQUE_IDS) {
      const [first, next] = COSTS[id];
      expect(first).toBeGreaterThan(0);
      expect(next).toBeLessThanOrEqual(first);
    }
  });

  it('implements all fourteen, in nondecreasing first-use cost order', () => {
    expect(LADDER).toHaveLength(14);
    expect(Object.keys(TECHNIQUES).sort()).toEqual([...LADDER].sort());
    for (let i = 1; i < LADDER.length; i++) {
      const previous = COSTS[LADDER[i - 1] as (typeof LADDER)[number]][0];
      expect(COSTS[LADDER[i] as (typeof LADDER)[number]][0]).toBeGreaterThanOrEqual(previous);
    }
  });

  it('lists the ladder as a prefix of decision 16’s own order — now the whole of it', () => {
    expect([...LADDER]).toEqual(TECHNIQUE_IDS.slice(0, LADDER.length));
    expect([...LADDER]).toEqual([...TECHNIQUE_IDS]);
  });

  it('gives every technique the id it is filed under', () => {
    for (const id of LADDER) expect(TECHNIQUES[id].name).toBe(id);
  });
});
