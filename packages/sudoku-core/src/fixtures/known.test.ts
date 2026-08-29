import { describe, expect, it } from 'vitest';
import { KNOWN_BY_LEVEL, KNOWN_PUZZLES } from './known.js';
import { LEVELS } from '../types.js';

// Shape only. Whether the givens actually admit exactly one solution is WP-B's
// test (it needs the solver); the strings were checked against a throwaway
// backtracking solver when they were transcribed and all six passed.
describe('known fixtures', () => {
  it('has one puzzle per level, in ladder order', () => {
    expect(KNOWN_PUZZLES.map((p) => p.level)).toEqual([...LEVELS]);
  });

  it.each(LEVELS)('%s is well formed and its solution agrees with its givens', (level) => {
    const p = KNOWN_BY_LEVEL[level];
    expect(p.level).toBe(level);
    expect(p.givens).toMatch(/^[0-9]{81}$/);
    expect(p.solution).toMatch(/^[1-9]{81}$/);
    expect(p.sotdScore).toBeGreaterThan(0);
    expect(p.source).toContain('sudokuoftheday.com');
    for (let i = 0; i < 81; i++) {
      const given = p.givens[i] as string;
      if (given !== '0') expect(given).toBe(p.solution[i]);
    }
  });

  it.each(LEVELS)('%s has a solution with no repeat in any unit', (level) => {
    const { solution } = KNOWN_BY_LEVEL[level];
    for (let k = 0; k < 9; k++) {
      const row = new Set<string>();
      const col = new Set<string>();
      const box = new Set<string>();
      for (let j = 0; j < 9; j++) {
        row.add(solution[k * 9 + j] as string);
        col.add(solution[j * 9 + k] as string);
        box.add(
          solution[
            (Math.floor(k / 3) * 3 + Math.floor(j / 3)) * 9 + (k % 3) * 3 + (j % 3)
          ] as string,
        );
      }
      expect([row.size, col.size, box.size]).toEqual([9, 9, 9]);
    }
  });

  it('scores rise with level', () => {
    const scores = KNOWN_PUZZLES.map((p) => p.sotdScore);
    expect(scores).toEqual([...scores].sort((a, b) => a - b));
  });
});
