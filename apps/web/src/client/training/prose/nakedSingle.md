The cheapest deduction on the whole ladder, and the one every other technique is
ultimately working towards: a square with exactly one candidate left.

## The rule

Pencil in the candidates for an empty square — the digits 1 to 9 that do not
already appear in its row, its column or its box. If only one digit survives,
that digit has nowhere else to go and nothing else can go there. Write it in.

## A worked example

Take the square at row 5, column 2. Its row already shows 1, 4, 7 and 9; its
column shows 2, 3 and 8; its box adds a 6. That accounts for eight of the nine
digits, so the only candidate left is 5, and the square must be a 5.

Notice what makes this cheap: you never look past the three units the square
belongs to. No other square's candidates matter, and you do not need a
pencil-mark grid to find one — a quick scan of the row, column and box is
enough.

## Where it shows up

Every placement made by a harder technique tends to hand you a run of these:
filling one square removes a candidate from up to twenty peers, and one of those
usually drops to a single. When you are stuck, the first thing to check is
whether an earlier placement left one of these behind.

Reference: our definition follows sudokuoftheday.com's **Single Candidate** at
[sudokuoftheday.com/techniques](https://www.sudokuoftheday.com/techniques); the
words above are our own.
