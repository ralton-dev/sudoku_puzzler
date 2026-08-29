/**
 * The library's only source of randomness (decision 3): a seeded PRNG, injected
 * everywhere. No `Math.random`, no `crypto`, no Node APIs. Same seed, same
 * puzzle — determinism is an acceptance criterion, not a nicety.
 *
 * mulberry32: 32-bit state, one multiply-xorshift round, good enough for
 * shuffling a sudoku grid and reproducible across engines because every step is
 * forced back into uint32 by `>>> 0` and `Math.imul`.
 */

/** A seeded random source returning a float in [0, 1). */
export type Rng = () => number;

/** mulberry32. `seed` is coerced to a uint32, so any integer works. */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A uniform integer in [0, max). `max` must be >= 1. */
export function randomInt(rng: Rng, max: number): number {
  return Math.floor(rng() * max);
}

/**
 * Fisher-Yates, in place, returning the same array. Backwards so each swap
 * draws from a shrinking prefix — the unbiased form.
 */
export function shuffle<T>(items: T[], rng: Rng): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = randomInt(rng, i + 1);
    const a = items[i] as T;
    const b = items[j] as T;
    items[i] = b;
    items[j] = a;
  }
  return items;
}
