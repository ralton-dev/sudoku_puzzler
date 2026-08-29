The Naked Pair one size up, with a twist that catches everybody the first time.

## The rule

Inside one unit, find three empty squares whose candidates, taken together,
amount to only three digits. Those three squares must hold those three digits
between them, one each, so the digits can be struck from every other square in
the unit.

The twist: the three squares do **not** each have to show all three digits. Any
mixture works, as long as no square strays outside the three. {5,6,9} {5,6}
{6,9} is a triple on {5,6,9}, and so is {2,4} {4,7} {2,7} — the classic case
where no square shows more than two candidates and there is no repeated list to
catch your eye.

## A worked example

Column 3 holds r1c3 {2,4}, r5c3 {4,7} and r8c3 {2,7}, and no other square in the
column is limited to those digits. Between the three of them they need a 2, a 4
and a 7, and there are exactly three squares, so the column's 2, 4 and 7 all
live there. Any other square in column 3 loses its 2, 4 and 7 candidates.

## Finding them

Look for squares with two or three candidates, then try to cover a run of them
with a set of three digits. A square with a single candidate is a Naked Single —
cheaper, and it fires first.

Reference: our definition follows sudokuoftheday.com's **Naked Triples** at
[sudokuoftheday.com/techniques](https://www.sudokuoftheday.com/techniques); the
words above are our own.
