/**
 * Technique 11 — SOTD's **Forcing Chains**
 * (https://www.sudokuoftheday.com/techniques/forcing-chains, read 2026-08-29):
 *
 *   Start from "cells with just 2 candidates". "Whichever value you would
 *   choose for one cell forces another cell to be just one of its two values" —
 *   so you follow the implications of each of the two choices separately. When
 *   both choices land the same digit in the same other cell, that digit is
 *   certain: "even though you don't know what the first cell will be, you
 *   definitely know the value in the second cell, so you can write it in!"
 *   SOTD stresses this is not guessing, because you are "simultaneously looking
 *   at the implications of either choice"; their own notation marks one branch
 *   with a `u` and the other with an `n` and looks for a pencilmark carrying
 *   both.
 *
 * Decision 16 costs it 4200 first, 2100 subsequently — the first rung above
 * X-Wing, and the only technique on the ladder that reasons forwards rather
 * than pattern-matching, which is why it is the expensive one to run as well as
 * to be charged for.
 *
 * ## What a chain link is here
 *
 * SOTD's chains are drawn link by link ("forces another cell to be just one of
 * its two values"), and each link is a deduction any beginner already owns: a
 * Single Candidate or a Single Position. So a branch is: put the digit in, then
 * repeatedly take the cheapest single available, exactly as `nakedSingle` and
 * `hiddenSingle` find it, and record what got placed. Nothing above the singles
 * is used inside a branch — a chain that needed an X-Wing halfway along would
 * not be a chain a person could follow, and it would also make the cost of this
 * rung meaningless.
 *
 * ## The depth bound
 *
 * `MAX_CHAIN_DEPTH` (12) placements per branch. SOTD: "Longer chains don't make
 * it conceptually any harder, but they do make it more likely that you'll make
 * mistakes along the way." Twelve is about as far as their `u`/`n` overlay stays
 * readable on a real board, which is the reason it is bounded at all.
 *
 * The bound is **not** a pure "find less" knob, and it is worth being precise
 * about why, because the obvious intuition is wrong. Raising it lets an
 * *earlier* start cell agree on something, and this technique returns the first
 * start cell that agrees — so a deeper bound can change *which* step is taken,
 * and with it the whole trajectory the rater follows afterwards. Every
 * placement it makes is sound at any bound (both branches agreeing is a proof),
 * but the score is not monotonic in the bound.
 *
 * Measured against the six `fixtures/known.ts` puzzles (WP-D2, this Mac):
 *
 *   | bound | six fixture scores                          |
 *   | ----- | ------------------------------------------- |
 *   | 4     | diabolical stalls (`null`) — too shallow     |
 *   | 6..18 | identical at every level — a flat plateau    |
 *   | 20,40 | diabolical stalls: a longer chain fires from |
 *   |       | an earlier start cell and the solve diverges |
 *
 * 12 sits in the middle of that plateau, so the choice is not balanced on an
 * edge. `calibration.test.ts` pins the bound, so changing it is deliberate and
 * arrives with the fixture table re-measured.
 *
 * ## Contradictions are not ours to exploit
 *
 * If a branch runs into a cell with no candidates left, the start cell's other
 * value is proven. That deduction is SOTD's **Nishio**, a separate technique on
 * their list and *not* one of decision 16's fourteen, so we abandon that start
 * cell rather than take the placement. Keeping the two apart is what stops this
 * rung quietly absorbing a technique the score does not pay for.
 *
 * ## Scan order (deterministic — WP-T1 re-validates against it)
 *
 * Start cells 0 -> 80 ascending, taking only cells with exactly two candidates.
 * For a start cell, the lower digit is followed first, then the higher. Of the
 * cells the two branches agree on, the **lowest cell index** is the step's
 * placement. The first start cell that agrees on anything is the step.
 *
 * ## `Step` shape (WP-T1/WP-T2 read this)
 *
 * `cells` is the chain, not a fixed-size pattern: `cells[0]` is the start cell,
 * `cells[cells.length - 1]` is the forced cell, and everything between is the
 * links the two branches walked through, first branch then second, deduped.
 * Length is therefore variable and is at least 2. `units` is `[]` on purpose —
 * a chain is not confined to a row, column or box the way every other technique
 * on the ladder is, and naming one would tell a learner something untrue.
 */

import type { Placement, Step } from '../types.js';
import { CELL_COUNT } from '../types.js';
import { digitsOf, popcount } from '../grid.js';
import { type TechniqueState, applyStep, cellList, cellName, cloneState, place } from './state.js';
import { nakedSingle } from './nakedSingle.js';
import { hiddenSingle } from './hiddenSingle.js';

/** Placements a single branch may make before it is abandoned. See the header. */
export const MAX_CHAIN_DEPTH = 12;

/** One followed implication chain: what it placed, in the order it placed it. */
interface Branch {
  order: number[];
  value: Map<number, number>;
}

export function forcingChains(state: TechniqueState): Step | null {
  for (let start = 0; start < CELL_COUNT; start++) {
    if ((state.grid[start] as number) !== 0) continue;
    const mask = state.cand[start] as number;
    if (popcount(mask) !== 2) continue;
    const [low, high] = digitsOf(mask) as [number, number];

    const first = follow(state, start, low);
    if (first === null) continue;
    const second = follow(state, start, high);
    if (second === null) continue;

    const agreed = lowestAgreement(first, second);
    if (agreed === null) continue;

    return describe(start, low, high, first, second, agreed);
  }
  return null;
}

/**
 * Put `digit` in `cell` and take singles from there, up to `MAX_CHAIN_DEPTH` of
 * them. `null` when the branch contradicts itself — see the header on Nishio.
 */
function follow(state: TechniqueState, cell: number, digit: number): Branch | null {
  const work = cloneState(state);
  place(work, cell, digit);

  const order: number[] = [];
  const value = new Map<number, number>();
  for (let depth = 0; depth < MAX_CHAIN_DEPTH; depth++) {
    if (dead(work)) return null;
    const step = nakedSingle(work) ?? hiddenSingle(work);
    if (step === null) break;
    applyStep(work, step);
    for (const { cell: at, digit: put } of step.placements) {
      order.push(at);
      value.set(at, put);
    }
  }
  return { order, value };
}

/** The lowest-indexed cell both branches put the same digit in, or `null`. */
function lowestAgreement(first: Branch, second: Branch): Placement | null {
  let best: Placement | null = null;
  for (const [cell, digit] of first.value) {
    if (second.value.get(cell) !== digit) continue;
    if (best === null || cell < best.cell) best = { cell, digit };
  }
  return best;
}

/** True when some empty cell has no candidate left — the branch is dead. */
function dead(state: TechniqueState): boolean {
  for (let i = 0; i < CELL_COUNT; i++) {
    if ((state.grid[i] as number) === 0 && (state.cand[i] as number) === 0) return true;
  }
  return false;
}

/** The links a branch walked to reach `target`, `target` itself excluded. */
function linksTo(branch: Branch, target: number): number[] {
  return branch.order.slice(0, branch.order.indexOf(target));
}

function describe(
  start: number,
  low: number,
  high: number,
  first: Branch,
  second: Branch,
  agreed: Placement,
): Step {
  const viaLow = linksTo(first, agreed.cell);
  const viaHigh = linksTo(second, agreed.cell);

  const seen = new Set<number>([agreed.cell]);
  const cells: number[] = [];
  for (const cell of [start, ...viaLow, ...viaHigh]) {
    if (seen.has(cell)) continue;
    seen.add(cell);
    cells.push(cell);
  }
  cells.push(agreed.cell);

  const forced = cellName(agreed.cell);
  const branchText = (digit: number, links: readonly number[]): string =>
    links.length === 0
      ? `a ${digit} there forces ${forced} to ${agreed.digit} straight away`
      : `a ${digit} there runs through ${cellList(links)} and forces ${forced} to ${agreed.digit}`;

  return {
    technique: 'forcingChains',
    cells,
    units: [],
    placements: [{ cell: agreed.cell, digit: agreed.digit }],
    eliminations: [],
    reason:
      `${cellName(start)} is either ${low} or ${high}: ${branchText(low, viaLow)}, and ` +
      `${branchText(high, viaHigh)}. Whichever way ${cellName(start)} goes, ${forced} is ` +
      `${agreed.digit}.`,
  };
}
