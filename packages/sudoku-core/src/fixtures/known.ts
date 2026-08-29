/**
 * Six real puzzles from sudokuoftheday.com, one per level, with SOTD's own
 * published difficulty score. This is the calibration oracle: WP-D asserts the
 * beginner..tricky fixtures rate at their level, and WP-D2 compares our
 * decision-16 score against `sotdScore` for all six and records the delta.
 *
 * All six are the daily puzzles of 2026-08-29, read that day from
 * https://www.sudokuoftheday.com/dailypuzzles/2026-08-29/<level> (each puzzle's
 * own URL is on its entry below). The givens were decoded from the rendered
 * board SVG; the solutions are SOTD's own, from each puzzle's `/solution` page,
 * not derived here. Every one was then checked independently: the solution is a
 * valid complete grid, it agrees with the givens, and the givens have exactly
 * one solution (decision 5). All six passed.
 *
 * ---------------------------------------------------------------------------
 * KNOWN DISCREPANCY, for WP-D2's calibration test — read before asserting.
 *
 * SOTD's published level ranges overlap; decision 16 resolves the overlaps by
 * lower bound, which makes `levelOf` a function but means our band boundaries
 * are NOT SOTD's labels. Five of the six agree. The sixth does not:
 *
 *   level SOTD calls it   sotdScore   band decision 16 puts it in
 *   beginner                  4200    beginner   (< 4300)          agrees
 *   easy                      5000    easy       (4300-5299)       agrees
 *   medium                    6450    medium     (5300-6499)       agrees
 *   tricky                    8750    FIENDISH   (8300-10999)      DISAGREES
 *   fiendish                  9800    fiendish   (8300-10999)      agrees
 *   diabolical               12950    diabolical (>= 11000)        agrees
 *
 * SOTD's own tricky range is 6500-9300, so 8750 is a legitimate tricky for them
 * and legitimately fiendish for us. This is decision 16 working as written, not
 * a bad fixture. So WP-D2 should assert **`levelOf(ourScore) ===
 * levelOf(sotdScore)`** — that our scoring agrees with SOTD's scoring — rather
 * than `=== fixture.level`, which would be asserting that decision 16's band
 * table equals SOTD's labels, which decision 16 says it does not. Do not adjust
 * costs to make the labels line up; costs are decision 16.
 * ---------------------------------------------------------------------------
 */

import type { Level } from '../types.js';

export interface KnownPuzzle {
  /** the level sudokuoftheday.com published this puzzle under */
  level: Level;
  /** sudokuoftheday.com's published difficulty score for this puzzle */
  sotdScore: number;
  /** 81 chars, row-major, '0' = empty */
  givens: string;
  /** 81 chars, row-major, no zeros */
  solution: string;
  /** the page it came from */
  source: string;
  /** ISO date the page was read */
  read: string;
}

const READ = '2026-08-29';
const url = (level: Level): string =>
  `https://www.sudokuoftheday.com/dailypuzzles/2026-08-29/${level}`;

export const KNOWN_BY_LEVEL: Readonly<Record<Level, KnownPuzzle>> = {
  // 39 clues.
  beginner: {
    level: 'beginner',
    sotdScore: 4200,
    givens: '000158300050023608103004000872000065460070083530000427000300501708640030005217000',
    solution: '627158394954723618183964752872431965469572183531896427246389571718645239395217846',
    source: url('beginner'),
    read: READ,
  },
  // 31 clues.
  easy: {
    level: 'easy',
    sotdScore: 5000,
    givens: '791008002000009015004002070050040607000020000307050090010300500930200000200600439',
    solution: '791568342623479815584132976152943687849726153367851294416397528935284761278615439',
    source: url('easy'),
    read: READ,
  },
  // 26 clues.
  medium: {
    level: 'medium',
    sotdScore: 6450,
    givens: '018000000200009400000057013300080700060000030007040001870620000005700002000000160',
    solution: '718432695253169478946857213324981756169275834587346921871623549695714382432598167',
    source: url('medium'),
    read: READ,
  },
  // 24 clues. See the KNOWN DISCREPANCY note above: 8750 is in decision 16's
  // fiendish band even though SOTD publishes this as tricky.
  tricky: {
    level: 'tricky',
    sotdScore: 8750,
    givens: '000409800060070000085000002000023001900000006700860000800000340000080010001507000',
    solution: '127459863369278154485316972654923781938741526712865439876192345593684217241537698',
    source: url('tricky'),
    read: READ,
  },
  // 24 clues.
  fiendish: {
    level: 'fiendish',
    sotdScore: 9800,
    givens: '004000070100009030500007200000008017000703000780500000007200009030900006090000800',
    solution: '924351678178629435563847291352468917416793582789512364847236159231985746695174823',
    source: url('fiendish'),
    read: READ,
  },
  // 24 clues.
  diabolical: {
    level: 'diabolical',
    sotdScore: 12950,
    givens: '000105000007030650090000010000002085030000060540900000010000090084020700000704000',
    solution: '863175942127439658495268317679342185231857469548916273712683594984521736356794821',
    source: url('diabolical'),
    read: READ,
  },
};

/** The same six, in ascending level order. */
export const KNOWN_PUZZLES: readonly KnownPuzzle[] = Object.values(KNOWN_BY_LEVEL);
