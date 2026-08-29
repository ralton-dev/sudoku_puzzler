/**
 * The shared machinery behind SOTD's Naked Pairs/Triples and Hidden
 * Pairs/Triples (techniques 6..9). The pair and the triple are the same search
 * at size 2 and size 3, so the scan lives here once and each technique file
 * supplies only its id, its size and its wording — which is also what makes
 * WP-D2's Naked Quad and Hidden Quad a two-line addition.
 *
 * ## Scan order, shared by all four (deterministic — WP-T1 relies on it)
 *
 * Units in `UNITS` order: rows 0..8, then columns 9..17, then boxes 18..26.
 * Inside a unit, the candidate combinations are visited in ascending
 * lexicographic order of their members — cell indices for the naked search,
 * digits for the hidden one. The first combination that removes at least one
 * candidate is the step; a genuine pattern that eliminates nothing is skipped,
 * because a step must change something.
 */

import type { Elimination, Step, TechniqueId } from '../types.js';
import { UNITS, digitsOf, popcount } from '../grid.js';
import { type TechniqueState, cellList, digitList, placesFor, unitName } from './state.js';

/** Every k-combination of `items`, ascending lexicographic by position. */
function combinations<T>(items: readonly T[], k: number): T[][] {
  const out: T[][] = [];
  const pick: T[] = [];
  const walk = (start: number): void => {
    if (pick.length === k) {
      out.push([...pick]);
      return;
    }
    for (let i = start; i < items.length; i++) {
      pick.push(items[i] as T);
      walk(i + 1);
      pick.pop();
    }
  };
  walk(0);
  return out;
}

/**
 * A **naked** subset: `size` cells in a unit whose candidates, taken together,
 * are only `size` digits. Those digits belong to those cells, so they come out
 * of every other cell in the unit.
 *
 * A cell with a single candidate is a Single Candidate (`nakedSingle`), cheaper
 * on the ladder, so members must have 2..`size` candidates.
 */
export function findNakedSubset(
  state: TechniqueState,
  size: number,
  technique: TechniqueId,
  label: string,
): Step | null {
  for (let u = 0; u < UNITS.length; u++) {
    const unit = UNITS[u] as readonly number[];
    const open = unit.filter((cell) => {
      const n = popcount(state.cand[cell] as number);
      return n >= 2 && n <= size;
    });
    if (open.length < size) continue;

    for (const group of combinations(open, size)) {
      let union = 0;
      for (const cell of group) union |= state.cand[cell] as number;
      if (popcount(union) !== size) continue;

      const digits = digitsOf(union);
      const inGroup = new Set(group);
      const eliminations: Elimination[] = [];
      for (const cell of unit) {
        if (inGroup.has(cell)) continue;
        const hit = digits.filter((d) => ((state.cand[cell] as number) & (1 << (d - 1))) !== 0);
        if (hit.length > 0) eliminations.push({ cell, digits: hit });
      }
      if (eliminations.length === 0) continue;

      return {
        technique,
        cells: group,
        units: [u],
        placements: [],
        eliminations,
        reason:
          `${cellList(group)} in ${unitName(u)} hold nothing but ${digitList(digits)} between ` +
          `them, so that ${label} owns those digits and they come out of the rest of ` +
          `${unitName(u)}.`,
      };
    }
  }
  return null;
}

/**
 * A **hidden** subset: `size` digits in a unit that can only go in `size` cells.
 * Those cells belong to those digits, so every *other* candidate comes out of
 * those cells. SOTD: "you're looking for a group of numbers that are limited to
 * only a small group of cells ... even though there will be other candidates in
 * the same cell 'hiding' them."
 *
 * A digit with one place in the unit is a Single Position (`hiddenSingle`),
 * cheaper on the ladder, so members must have 2..`size` places.
 */
export function findHiddenSubset(
  state: TechniqueState,
  size: number,
  technique: TechniqueId,
  label: string,
): Step | null {
  for (let u = 0; u < UNITS.length; u++) {
    const unit = UNITS[u] as readonly number[];
    const live: number[] = [];
    const places = new Map<number, number[]>();
    for (let digit = 1; digit <= 9; digit++) {
      const at = placesFor(state, unit, digit);
      if (at.length >= 2 && at.length <= size) {
        live.push(digit);
        places.set(digit, at);
      }
    }
    if (live.length < size) continue;

    for (const digits of combinations(live, size)) {
      const cells = new Set<number>();
      for (const digit of digits) for (const cell of places.get(digit) as number[]) cells.add(cell);
      if (cells.size !== size) continue;

      const keep = digits.reduce((mask, d) => mask | (1 << (d - 1)), 0);
      const group = [...cells].sort((a, b) => a - b);
      const eliminations: Elimination[] = [];
      for (const cell of group) {
        const extra = (state.cand[cell] as number) & ~keep;
        if (extra !== 0) eliminations.push({ cell, digits: digitsOf(extra) });
      }
      if (eliminations.length === 0) continue;

      return {
        technique,
        cells: group,
        units: [u],
        placements: [],
        eliminations,
        reason:
          `In ${unitName(u)} the digits ${digitList(digits)} can only go in ${cellList(group)}, ` +
          `so that ${label} fills those cells and every other candidate there can go.`,
      };
    }
  }
  return null;
}
