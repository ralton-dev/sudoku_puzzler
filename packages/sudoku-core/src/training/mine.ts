/**
 * The miner behind `src/training/examples.json` (decision 18, WP-T1).
 *
 *     pnpm --filter sudoku-core mine-examples
 *
 * It generates puzzles across all six levels from fixed seeds, walks each
 * `rate()` trace, and for every technique keeps the clearest few positions where
 * that technique is the step the ladder *chose* — i.e. nothing cheaper applied,
 * because `rate()` restarts from `LADDER[0]` after every application, so a step
 * in its trace is by construction the cheapest thing available at that moment.
 *
 * ## How it runs, given a dependency-free package
 *
 * Decision 3 says the core library has no dependencies and no Node APIs, and
 * `tsconfig.json` enforces the second half with `types: []`. A miner has to
 * write a file, so the file-writing is pushed out of TypeScript entirely:
 *
 *   - this module writes the JSON to **stdout** and its human-readable summary
 *     to **stderr**, and the `mine-examples` script line does the redirect;
 *   - the only Node surface it touches is `process.stdout`/`process.stderr`,
 *     declared ambiently below, so no `@types/node` and no change to `types: []`;
 *   - it is run from the package's own `tsc` build output (`dist/training/
 *     mine.js`) rather than through a TypeScript runner, because the source uses
 *     `.js` specifiers that Node's type stripping does not resolve back to
 *     `.ts`, and because adding `tsx` would put a dependency on the package.
 *
 * That is why there is no `tsconfig.mine.json`: nothing here needs Node types,
 * so `mine.ts` stays inside the ordinary `tsconfig.json` include and is
 * type-checked and linted with the rest of the package.
 *
 * **It must not import `./index.js`.** That module imports `examples.json`, and
 * the shell truncates `examples.json` the moment the redirect opens. The imports
 * below are all deliberately direct (`../rater.js`, `../level.js`, ...).
 *
 * ## What a stored example is
 *
 * `{ grid, eliminated, step }` where `grid` is the position as the ladder
 * reached it and `eliminated` is the ledger of candidates the *earlier* steps
 * had already ruled out. That ledger cannot be read off `Step.eliminations` —
 * a placement's knock-on peer removals are deliberately not listed there (see
 * `applyStep` in `techniques/state.ts`) — so it is computed by diffing the live
 * state against naive candidates, which is exactly what `createState` replays.
 *
 * ## Determinism
 *
 * Everything is a pure function of the seed range: `generate` is deterministic
 * (decision 3), `rate` is deterministic, every technique returns the first
 * instance in a documented scan order, and the selection and sort below are
 * total orders with no ties left to chance. Re-running the miner produces a
 * byte-identical file; `mine-examples` finishes with `prettier --write` so the
 * repo-wide `prettier --check` in the gate is satisfied, and prettier is itself
 * deterministic.
 *
 * ## Selection
 *
 * The plan asks for "the first 5 distinct positions where it is the step
 * chosen", and separately for a preference for steps with few pattern cells and
 * at most three eliminations — clearer to teach. Those two pull against each
 * other, so the reading implemented here is: collect every distinct position in
 * discovery order, rank them by clarity, and keep the best five. The final file
 * is then re-sorted into technique (ladder) order, then discovery order, which
 * is seed order within a level.
 *
 * ## What cannot be mined: `nakedQuad` and `hiddenQuad`
 *
 * Twelve of the fourteen techniques reach five examples. `swordfish` reaches
 * five only at 2000 seeds a level. `nakedQuad` and `hiddenQuad` reach **none**,
 * at any seed count, and the reason is structural rather than a matter of
 * patience. Measured over 300 seeds a level (1571 distinct puzzles, 77905
 * positions in their traces):
 *
 *   - a naked quad exists somewhere on the board at **35852** of those
 *     positions and a hidden quad at **16722** — they are not rare patterns;
 *   - but of the **654** positions where the ladder had actually exhausted
 *     rungs 1..10 and was down to Forcing Chains, a naked quad was available at
 *     **0** and a hidden quad at **0**. A swordfish was available at 20.
 *
 * So the thing standing between the quads and the trace is not Forcing Chains
 * — suppressing rung 11 to see "whether a quad would apply" (the obvious next
 * idea) changes nothing, because at every one of those 654 positions rung 12
 * and rung 13 were already `null`. It is the *pairs and triples*: in a nine-cell
 * unit a naked quad's complement is a hidden subset of size `n - 4`, and for the
 * unit sizes that survive to a stalled position that complement is a pair or a
 * triple, which rungs 6..9 take first and more cheaply. A quad only ever gets
 * to be the chosen step in a unit with nine empty cells, and a position that
 * stalls the first ten rungs no longer has one.
 *
 * That is reported, not worked around: the plan says to raise the seed count and
 * then say so rather than hand-craft, and a hand-built quad would be exactly the
 * thing `examples.test.ts` exists to prevent — a position the library would
 * never actually choose that technique in. `examples.test.ts` records the two
 * zeros as expected counts, so if a future ladder change makes a quad reachable
 * the count moves and the file gets re-mined.
 */

/**
 * The two Node streams this script writes to, declared rather than imported:
 * `@types/node` is not available to this package and must not become available
 * (decision 3, `types: []` in `tsconfig.json`).
 */
declare const process: {
  stdout: { write(chunk: string): boolean };
  stderr: { write(chunk: string): boolean };
};

import type { Elimination, Level, Step, TechniqueId, TrainingExample } from '../types.js';
import { CELL_COUNT, LEVELS, TECHNIQUE_IDS } from '../types.js';
import { candidates, digitsOf, formatGrid } from '../grid.js';
import { GenerationFailed } from '../generator.js';
import { generate } from '../level.js';
import { rate } from '../rater.js';
import { type TechniqueState, applyStep, createState } from '../techniques/index.js';

/**
 * Seeds tried per level, `FIRST_SEED` upwards. Fixed: the run is reproducible.
 *
 * 2000 is not a round number picked for comfort — it is where `swordfish`
 * crosses the plan's threshold. Measured on this Mac (see the file header's
 * "What cannot be mined"): at 300 seeds a level the miner found 0 swordfish
 * positions in 1571 distinct puzzles; at 2000 it found 6 in 10459. Everything
 * else on the ladder is comfortably covered well below 300. The whole run takes
 * about two minutes.
 */
const SEEDS_PER_LEVEL = 2000;

/** The first seed of every level's range. */
const FIRST_SEED = 1;

/** At most this many positions are kept per technique (the plan's "first 5"). */
const EXAMPLES_PER_TECHNIQUE = 5;

/** A step eliminating more than this is demoted in the clarity ranking. */
const MAX_PREFERRED_ELIMINATIONS = 3;

/** One position found while walking a trace, with where it was found. */
interface Found {
  example: TrainingExample;
  level: Level;
  seed: number;
  /** discovery index across the whole run — the total order every tie falls back on */
  order: number;
}

/** Per-level generation accounting, for the stderr summary. */
interface LevelStats {
  level: Level;
  seeds: number;
  puzzles: number;
  duplicates: number;
  failures: number;
  unrated: number;
  ms: number;
}

interface Mined {
  /** the file's contents, in ladder order then discovery order */
  examples: TrainingExample[];
  /** every distinct position found, per technique — the "found" column */
  found: Map<TechniqueId, Found[]>;
  /** the ones that made the cut, per technique — the "kept" column */
  kept: Map<TechniqueId, Found[]>;
  levels: LevelStats[];
}

/**
 * The ledger of candidates earlier steps removed: for every empty cell, the
 * digits naive peer elimination still allows but the live state no longer does.
 * `createState(grid, ledger)` reproduces `state` exactly.
 */
function ledger(state: TechniqueState): Elimination[] {
  const out: Elimination[] = [];
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    if ((state.grid[cell] as number) !== 0) continue;
    const missing = candidates(state.grid, cell) & ~(state.cand[cell] as number);
    if (missing !== 0) out.push({ cell, digits: digitsOf(missing) });
  }
  return out;
}

/**
 * A `Step` rebuilt field by field, in the order `types.ts` declares them, with
 * `Rating.steps`' extra `cost` dropped — the stored type is `Step`. Writing the
 * keys out is also what makes the JSON's key order a property of this file
 * rather than of whichever technique produced the step.
 */
function plainStep(step: Step): Step {
  return {
    technique: step.technique,
    cells: [...step.cells],
    units: [...(step.units ?? [])],
    placements: step.placements.map(({ cell, digit }) => ({ cell, digit })),
    eliminations: step.eliminations.map(({ cell, digits }) => ({ cell, digits: [...digits] })),
    reason: step.reason,
  };
}

/** How clear a step is to teach: lower sorts first. See the header on selection. */
function clarity(step: Step): [number, number, number] {
  const removed = step.eliminations.reduce((total, e) => total + e.digits.length, 0);
  return [
    step.eliminations.length > MAX_PREFERRED_ELIMINATIONS ? 1 : 0,
    step.cells.length,
    removed,
  ];
}

/** Walk one puzzle's rating, recording a candidate position for every step. */
function walk(givens: Uint8Array, level: Level, seed: number, out: Found[], from: number): number {
  const rating = rate(givens);
  if (rating === null) return from;

  const state = createState(givens);
  let order = from;
  for (const rated of rating.steps) {
    const step = plainStep(rated);
    out.push({
      example: {
        technique: step.technique,
        grid: formatGrid(state.grid),
        eliminated: ledger(state),
        step,
      },
      level,
      seed,
      order: order++,
    });
    applyStep(state, step);
  }
  return order;
}

/** Generate across every level and collect every candidate position. */
function collect(): { found: Found[]; levels: LevelStats[] } {
  const found: Found[] = [];
  const levels: LevelStats[] = [];
  const seenPuzzles = new Set<string>();
  let order = 0;

  for (const level of LEVELS) {
    const startedAt = Date.now();
    const stats: LevelStats = {
      level,
      seeds: SEEDS_PER_LEVEL,
      puzzles: 0,
      duplicates: 0,
      failures: 0,
      unrated: 0,
      ms: 0,
    };

    for (let seed = FIRST_SEED; seed < FIRST_SEED + SEEDS_PER_LEVEL; seed++) {
      let givens: Uint8Array;
      try {
        givens = generate({ level, seed }).givens;
      } catch (error) {
        if (!(error instanceof GenerationFailed)) throw error;
        stats.failures++;
        continue;
      }
      const key = formatGrid(givens);
      // `generate` retries seed+1, seed+2, ... internally, so neighbouring seeds
      // routinely land on the same grid; mining it twice would only produce
      // positions the dedupe throws away.
      if (seenPuzzles.has(key)) {
        stats.duplicates++;
        continue;
      }
      seenPuzzles.add(key);
      stats.puzzles++;

      const before = order;
      order = walk(givens, level, seed, found, order);
      if (order === before) stats.unrated++;
    }

    stats.ms = Date.now() - startedAt;
    levels.push(stats);
  }

  return { found, levels };
}

/** Distinct positions per technique, in discovery order. */
function group(found: readonly Found[]): Map<TechniqueId, Found[]> {
  const out = new Map<TechniqueId, Found[]>(TECHNIQUE_IDS.map((id) => [id, []]));
  const seen = new Set<string>();
  for (const candidate of found) {
    const key = `${candidate.example.technique}:${candidate.example.grid}`;
    if (seen.has(key)) continue;
    seen.add(key);
    (out.get(candidate.example.technique) as Found[]).push(candidate);
  }
  return out;
}

/** Rank by clarity, keep the best `EXAMPLES_PER_TECHNIQUE`, restore seed order. */
function choose(all: readonly Found[]): Found[] {
  const ranked = [...all].sort((a, b) => {
    const left = clarity(a.example.step);
    const right = clarity(b.example.step);
    for (let i = 0; i < left.length; i++) {
      const delta = (left[i] as number) - (right[i] as number);
      if (delta !== 0) return delta;
    }
    return a.order - b.order;
  });
  return ranked.slice(0, EXAMPLES_PER_TECHNIQUE).sort((a, b) => a.order - b.order);
}

function mine(): Mined {
  const { found, levels } = collect();
  const grouped = group(found);
  const kept = new Map<TechniqueId, Found[]>();
  const examples: TrainingExample[] = [];

  // TECHNIQUE_IDS is the ladder order, so iterating it *is* the primary sort.
  for (const id of TECHNIQUE_IDS) {
    const picked = choose(grouped.get(id) as Found[]);
    kept.set(id, picked);
    for (const candidate of picked) examples.push(candidate.example);
  }

  return { examples, found: grouped, kept, levels };
}

/** The stderr summary — counts, seeds and wall time, for the WP-T1 report. */
function summary(mined: Mined, ms: number): string {
  const lines: string[] = [];
  lines.push('level       seeds  puzzles  dupes  failed  unrated       ms');
  for (const stats of mined.levels) {
    lines.push(
      [
        stats.level.padEnd(10),
        String(stats.seeds).padStart(6),
        String(stats.puzzles).padStart(9),
        String(stats.duplicates).padStart(7),
        String(stats.failures).padStart(8),
        String(stats.unrated).padStart(9),
        String(stats.ms).padStart(9),
      ].join(''),
    );
  }
  lines.push('');
  lines.push('technique          found  kept');
  for (const id of TECHNIQUE_IDS) {
    const found = (mined.found.get(id) as Found[]).length;
    const kept = (mined.kept.get(id) as Found[]).length;
    lines.push(
      [
        id.padEnd(17),
        String(found).padStart(7),
        String(kept).padStart(6),
        kept < 3 ? "   <- SHORT of the plan's three" : '',
      ].join(''),
    );
  }
  lines.push('');
  lines.push(`${mined.examples.length} examples, ${ms} ms total.`);
  return `${lines.join('\n')}\n`;
}

const startedAt = Date.now();
const mined = mine();
process.stdout.write(`${JSON.stringify(mined.examples, null, 2)}\n`);
process.stderr.write(summary(mined, Date.now() - startedAt));
