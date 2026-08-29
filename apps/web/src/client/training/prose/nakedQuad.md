The Naked Pair and Naked Triple at size four — and, on this ladder, a technique
you will never actually need.

## The rule

Inside one unit, find four empty squares whose candidates together amount to
only four digits. Those four squares hold those four digits between them, one
each, so the four digits can be struck from every other square in the unit. As
with the triple, the squares need not each show all four candidates: {1,2}
{2,3} {3,4} {1,4} is a quad on {1,2,3,4} just as much as four squares showing
all four digits.

## A worked example

Row 2 holds r2c1 {1,2}, r2c4 {2,3}, r2c6 {3,4} and r2c8 {1,4}, and every other
square in the row carries at least one digit outside {1,2,3,4}. The four squares
need a 1, a 2, a 3 and a 4 between them and there are exactly four of them, so
row 2's 1, 2, 3 and 4 all live there — and come out of the rest of the row.

## Why this page has no example to practise

No position mined from our generator ever reaches it, and the reason is
structural: in a nine-square unit a naked quad's complement is a hidden subset of
size *n* − 4, which for any unit with fewer than nine empty squares is a pair or
a triple — and those rungs are cheaper, so the solver takes them first. A quad
can only ever be the chosen step in a unit with nine empty squares, and a
position hard enough to reach this rung no longer has one. Explanation only,
then; nothing was hand-crafted to fill the gap.

Reference: our definition follows sudokuoftheday.com's **Naked Pairs/Triples**
family at
[sudokuoftheday.com/techniques](https://www.sudokuoftheday.com/techniques); the
words above are our own.
