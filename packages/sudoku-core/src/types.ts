/**
 * The frozen shape of the core library. Decisions 1, 4, 16 and 18.
 *
 * Nothing here is generic over board size: 9x9 only, fixed-size types, no
 * `size` parameter anywhere (decision 1). Do not generalise "for later".
 */

/**
 * A 9x9 board, row-major, index 0 = r0c0 .. index 80 = r8c8.
 * Each entry is 0 (empty) or 1..9. Length is always exactly 81 (decision 1).
 */
export type Grid = Uint8Array;

/** Cells on a 9x9 board. */
export const CELL_COUNT = 81;

/**
 * The six difficulty levels, in ascending order (decision 4). These strings are
 * verbatim what the DB stores and the HTTP API sends; do not rename or reorder.
 */
export const LEVELS = ['beginner', 'easy', 'medium', 'tricky', 'fiendish', 'diabolical'] as const;

export type Level = (typeof LEVELS)[number];

/**
 * The 14 solving techniques of decision 16, in ladder order — cheapest first.
 * The rater applies them in exactly this order, restarting from the top after
 * every successful application. WP-D implements 1..10, WP-D2 implements 11..14.
 */
export const TECHNIQUE_IDS = [
  'nakedSingle', // 1  Single Candidate
  'hiddenSingle', // 2  Single Position
  'candidateLines', // 3  Candidate Lines (pointing pair/triple)
  'doublePairs', // 4  Double Pairs
  'multipleLines', // 5  Multiple Lines
  'nakedPair', // 6  Naked Pair
  'hiddenPair', // 7  Hidden Pair
  'nakedTriple', // 8  Naked Triple
  'hiddenTriple', // 9  Hidden Triple
  'xWing', // 10 X-Wing
  'forcingChains', // 11 Forcing Chains
  'nakedQuad', // 12 Naked Quad
  'hiddenQuad', // 13 Hidden Quad
  'swordfish', // 14 Swordfish
] as const;

export type TechniqueId = (typeof TECHNIQUE_IDS)[number];

/** A digit placed into a cell by a technique. */
export interface Placement {
  /** 0..80 */
  cell: number;
  /** 1..9 */
  digit: number;
}

/** Candidates a technique removes from a cell. */
export interface Elimination {
  /** 0..80 */
  cell: number;
  /** the candidate digits removed, 1..9 */
  digits: number[];
}

/**
 * One application of one technique. This is both the rater's trace and the
 * training content (decision 18), so **every field is filled** by the technique
 * that produced it — `cells` is the pattern (e.g. the four X-wing corners),
 * `units` the units the pattern lives in, and `reason` is one sentence a learner
 * can read: "7 in row 3 can only go in box 1, so remove 7 from the rest of box 1".
 *
 * A step always changes something: at least one placement or one elimination.
 */
export interface Step {
  technique: TechniqueId;
  /** the pattern cells, 0..80 */
  cells: number[];
  /** optional unit indices the pattern spans (rows 0-8, cols 9-17, boxes 18-26) */
  units?: number[];
  placements: Placement[];
  eliminations: Elimination[];
  /** one plain sentence explaining why the step is valid */
  reason: string;
}

/** A puzzle: the clues, the one solution they admit (decision 5), and its level. */
export interface Puzzle {
  givens: Grid;
  solution: Grid;
  level: Level;
  seed: number;
}

/**
 * The result of rating a grid: the decision-16 cumulative cost, the level that
 * score falls in, and the full trace. `rate()` returns `null` instead of a
 * Rating when the ladder stalls (the puzzle needs a guess) — such a puzzle has
 * no score and is never served (decision 16).
 */
export interface Rating {
  score: number;
  level: Level;
  /** every step the ladder took, in order, each with the cost it added */
  steps: Array<Step & { cost: number }>;
}

/**
 * A committed training position (decision 18, mined by WP-T1 into
 * `src/training/examples.json`).
 *
 * `grid` is the 81-char position; `eliminated` is the candidates earlier steps
 * had already removed, so the client can rebuild the exact candidate state the
 * step was found in without shipping a solver to the browser.
 */
export interface TrainingExample {
  technique: TechniqueId;
  /** 81 chars, '0' or '.' for empty */
  grid: string;
  eliminated: Elimination[];
  step: Step;
}
