import { describe, expect, it } from 'vitest';
import {
  ALL_DIGITS,
  BOXES,
  BOX_OF,
  COLS,
  COL_OF,
  PEERS,
  ROWS,
  ROW_OF,
  UNITS,
  UNITS_OF,
  bitFor,
  candidates,
  digitsOf,
  emptyGrid,
  formatGrid,
  isComplete,
  isValidGrid,
  lowestDigit,
  parseGrid,
  popcount,
} from './grid.js';
import { KNOWN_BY_LEVEL, KNOWN_PUZZLES } from './fixtures/known.js';
import { CELL_COUNT } from './types.js';

describe('bitmask helpers', () => {
  it('puts digit d in bit d-1, not bit d', () => {
    expect(bitFor(1)).toBe(0b000000001);
    expect(bitFor(9)).toBe(0b100000000);
    expect(ALL_DIGITS).toBe(0b111111111);
  });

  it('round-trips a digit set through the mask', () => {
    const mask = bitFor(1) | bitFor(4) | bitFor(9);
    expect(mask).toBe(265);
    expect(digitsOf(mask)).toEqual([1, 4, 9]);
    expect(popcount(mask)).toBe(3);
    expect(lowestDigit(mask)).toBe(1);
  });

  it('handles the empty and full masks', () => {
    expect(digitsOf(0)).toEqual([]);
    expect(popcount(0)).toBe(0);
    expect(lowestDigit(0)).toBe(0);
    expect(digitsOf(ALL_DIGITS)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(popcount(ALL_DIGITS)).toBe(9);
    expect(lowestDigit(bitFor(7))).toBe(7);
  });
});

describe('unit and peer tables', () => {
  it('has 9 rows, 9 columns and 9 boxes of 9 cells each', () => {
    for (const table of [ROWS, COLS, BOXES]) {
      expect(table).toHaveLength(9);
      for (const unit of table) expect(unit).toHaveLength(9);
    }
  });

  it('orders UNITS as rows 0-8, columns 9-17, boxes 18-26', () => {
    expect(UNITS).toHaveLength(27);
    expect(UNITS[0]).toEqual(ROWS[0]);
    expect(UNITS[9]).toEqual(COLS[0]);
    expect(UNITS[18]).toEqual(BOXES[0]);
    // r1c4 (index 13) is in row 1, column 4, box 1.
    expect(UNITS_OF[13]).toEqual([1, 9 + 4, 18 + 1]);
  });

  it('covers every cell exactly once per unit kind', () => {
    for (const table of [ROWS, COLS, BOXES]) {
      const seen = new Set<number>();
      for (const unit of table) for (const cell of unit) seen.add(cell);
      expect(seen.size).toBe(CELL_COUNT);
    }
  });

  it('agrees with ROW_OF / COL_OF / BOX_OF', () => {
    for (let i = 0; i < CELL_COUNT; i++) {
      expect(ROWS[ROW_OF[i] as number]).toContain(i);
      expect(COLS[COL_OF[i] as number]).toContain(i);
      expect(BOXES[BOX_OF[i] as number]).toContain(i);
    }
    // Box 4 is the middle box: rows 3-5, columns 3-5.
    expect(BOXES[4]).toEqual([30, 31, 32, 39, 40, 41, 48, 49, 50]);
  });

  it('gives every cell exactly 20 peers, sorted and excluding itself', () => {
    for (let i = 0; i < CELL_COUNT; i++) {
      const peers = PEERS[i] as readonly number[];
      expect(peers).toHaveLength(20);
      expect(peers).not.toContain(i);
      expect([...peers]).toEqual([...peers].sort((a, b) => a - b));
    }
  });

  it('makes peership symmetric', () => {
    for (let i = 0; i < CELL_COUNT; i++) {
      for (const j of PEERS[i] as readonly number[]) {
        expect(PEERS[j]).toContain(i);
      }
    }
  });

  it('names the right peers for r0c0', () => {
    expect(PEERS[0]).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 18, 19, 20, 27, 36, 45, 54, 63, 72,
    ]);
  });
});

describe('parseGrid / formatGrid', () => {
  it('round-trips every fixture', () => {
    for (const puzzle of KNOWN_PUZZLES) {
      expect(formatGrid(parseGrid(puzzle.givens))).toBe(puzzle.givens);
      expect(formatGrid(parseGrid(puzzle.solution))).toBe(puzzle.solution);
    }
  });

  it('treats . and 0 alike, and formats empties as 0', () => {
    const dots = '.'.repeat(80) + '5';
    const grid = parseGrid(dots);
    expect(grid[80]).toBe(5);
    expect(formatGrid(grid)).toBe('0'.repeat(80) + '5');
  });

  it('rejects the wrong length', () => {
    expect(() => parseGrid('0'.repeat(80))).toThrow(/81 characters/);
    expect(() => parseGrid('0'.repeat(82))).toThrow(/81 characters/);
  });

  it('rejects a character that is not a digit or a dot', () => {
    expect(() => parseGrid('x' + '0'.repeat(80))).toThrow(/bad character/);
    expect(() => parseGrid('0'.repeat(40) + ' ' + '0'.repeat(40))).toThrow(/bad character/);
  });

  it('returns a fresh array each time', () => {
    const a = parseGrid('0'.repeat(81));
    const b = parseGrid('0'.repeat(81));
    a[0] = 9;
    expect(b[0]).toBe(0);
    expect(emptyGrid()).toHaveLength(CELL_COUNT);
  });
});

describe('isValidGrid', () => {
  it('accepts the empty grid and every fixture, givens and solution', () => {
    expect(isValidGrid(emptyGrid())).toBe(true);
    for (const puzzle of KNOWN_PUZZLES) {
      expect(isValidGrid(parseGrid(puzzle.givens))).toBe(true);
      expect(isValidGrid(parseGrid(puzzle.solution))).toBe(true);
    }
  });

  it('rejects a duplicate in a row, a column and a box', () => {
    const row = emptyGrid();
    row[0] = 5;
    row[8] = 5;
    expect(isValidGrid(row)).toBe(false);

    const col = emptyGrid();
    col[0] = 5;
    col[72] = 5;
    expect(isValidGrid(col)).toBe(false);

    // 0 and 10 share box 0 but neither a row nor a column.
    const box = emptyGrid();
    box[0] = 5;
    box[10] = 5;
    expect(isValidGrid(box)).toBe(false);
  });

  it('rejects a value outside 0..9', () => {
    const grid = emptyGrid();
    grid[0] = 10;
    expect(isValidGrid(grid)).toBe(false);
  });

  it('rejects a grid of the wrong length', () => {
    expect(isValidGrid(new Uint8Array(80))).toBe(false);
  });
});

describe('isComplete', () => {
  it('is true for a solved fixture and false for its givens', () => {
    for (const puzzle of KNOWN_PUZZLES) {
      expect(isComplete(parseGrid(puzzle.solution))).toBe(true);
      expect(isComplete(parseGrid(puzzle.givens))).toBe(false);
    }
  });

  it('is false for a full but invalid grid', () => {
    const grid = parseGrid(KNOWN_BY_LEVEL.easy.solution);
    // swap two cells in the same row so the row repeats a digit
    const a = grid[0] as number;
    grid[0] = grid[1] as number;
    grid[1] = a;
    expect(isComplete(grid)).toBe(false);
    // the swap made it invalid, not merely incomplete
    expect(isValidGrid(grid)).toBe(false);
  });

  it('is false for the empty grid', () => {
    expect(isComplete(emptyGrid())).toBe(false);
  });
});

describe('candidates', () => {
  it('is every digit for an empty grid', () => {
    const grid = emptyGrid();
    expect(candidates(grid, 40)).toBe(ALL_DIGITS);
  });

  it('is 0 for a filled cell — not the mask of the digit in it', () => {
    const grid = parseGrid(KNOWN_BY_LEVEL.beginner.givens);
    expect(grid[3]).toBe(1);
    expect(candidates(grid, 3)).toBe(0);
  });

  it('removes exactly the digits its peers use', () => {
    const grid = parseGrid(KNOWN_BY_LEVEL.beginner.givens);
    const used = new Set<number>();
    for (const peer of PEERS[0] as readonly number[]) {
      const value = grid[peer] as number;
      if (value !== 0) used.add(value);
    }
    const expected = digitsOf(ALL_DIGITS).filter((d) => !used.has(d));
    expect(digitsOf(candidates(grid, 0))).toEqual(expected);
  });

  it('always contains the solution digit for every empty cell of every fixture', () => {
    for (const puzzle of KNOWN_PUZZLES) {
      const givens = parseGrid(puzzle.givens);
      const solution = parseGrid(puzzle.solution);
      for (let i = 0; i < CELL_COUNT; i++) {
        if ((givens[i] as number) !== 0) continue;
        expect(candidates(givens, i) & bitFor(solution[i] as number)).not.toBe(0);
      }
    }
  });

  it('is 0 for an empty cell whose peers use all nine digits', () => {
    // Fill row 0 and column 0 around r0c0 with 1..9 minus nothing left over:
    // eight distinct digits in the row plus a ninth down the column.
    const grid = emptyGrid();
    for (let c = 1; c <= 8; c++) grid[c] = c; // 1..8 across row 0
    grid[9 * 4] = 9; // 9 in column 0
    expect(candidates(grid, 0)).toBe(0);
    expect(grid[0]).toBe(0); // still empty — 0 here means "unsolvable", not "filled"
  });
});
