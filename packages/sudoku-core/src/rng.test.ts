import { describe, expect, it } from 'vitest';
import { createRng, randomInt, shuffle } from './rng.js';

const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i);

describe('createRng', () => {
  it('is deterministic for a seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    expect(range(20).map(a)).toEqual(range(20).map(b));
  });

  it('diverges for different seeds', () => {
    const a = range(20).map(createRng(1));
    const b = range(20).map(createRng(2));
    expect(a).not.toEqual(b);
  });

  it('stays in [0, 1)', () => {
    const rng = createRng(7);
    for (let i = 0; i < 10_000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('works for seed 0 and does not get stuck', () => {
    const rng = createRng(0);
    const first = range(10).map(rng);
    expect(new Set(first).size).toBe(10);
  });
});

describe('randomInt', () => {
  it('stays in [0, max) and covers every value', () => {
    const rng = createRng(3);
    const seen = new Set<number>();
    for (let i = 0; i < 5_000; i++) {
      const v = randomInt(rng, 9);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(9);
      seen.add(v);
    }
    expect(seen.size).toBe(9);
  });
});

describe('shuffle', () => {
  it('permutes in place and returns the same array', () => {
    const items = range(9);
    const out = shuffle(items, createRng(5));
    expect(out).toBe(items);
    expect([...out].sort((x, y) => x - y)).toEqual(range(9));
  });

  it('is deterministic for a seed', () => {
    expect(shuffle(range(50), createRng(11))).toEqual(shuffle(range(50), createRng(11)));
  });

  it('actually reorders', () => {
    expect(shuffle(range(50), createRng(11))).not.toEqual(range(50));
  });

  it('leaves a one-element array alone', () => {
    expect(shuffle(['x'], createRng(1))).toEqual(['x']);
  });
});
