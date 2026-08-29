The first of the subset techniques: two squares that between them own two digits.

## The rule

Inside one unit — a row, a column or a box — find two empty squares whose
candidates are the *same* two digits and nothing else. You do not know which
square takes which digit, but you know the two squares use both digits between
them: one each. Those two digits are therefore unavailable to every other square
in the unit, and can be struck out of all of them.

## A worked example

Row 4 has two squares marked {3,8} and nothing else: r4c2 and r4c7. Either r4c2
is 3 and r4c7 is 8, or the other way round. Either way row 4's 3 and row 4's 8
are both inside that pair, so no other square in row 4 can be a 3 or an 8. If
r4c5 was carrying {3,5,9}, it is now {5,9} — and if that leaves a square with
one candidate, a Naked Single follows for free.

## Reading it

The word "naked" means the pair is on show: you can see both cells' candidate
lists and they match. Two things trip people up. The pair must be exactly two
digits — {3,8} and {3,8,9} is not a pair — and the pair must share a unit, so a
pair in a box that also shares a row lets you clean both.

Reference: our definition follows sudokuoftheday.com's **Naked Pairs** at
[sudokuoftheday.com/techniques](https://www.sudokuoftheday.com/techniques); the
words above are our own.
