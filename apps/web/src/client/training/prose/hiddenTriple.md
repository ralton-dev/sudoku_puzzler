Three digits that between them own three squares — the Hidden Pair one size up.

## The rule

Take a unit and, digit by digit, note which squares could still take it. If you
can find three digits whose candidate squares all fall inside the *same* three
squares, those three digits fill those three squares between them. Every other
candidate in the three squares can be erased.

As with the Naked Triple, the fit need not be perfect: each of the three digits
must be confined to the three squares, but a digit may be able to go in only two
of them. What matters is that nothing leaks outside.

## A worked example

In row 7 the digit 2 can go only at r7c1, r7c5 or r7c9; the digit 6 only at r7c1
or r7c9; the digit 8 only at r7c5 or r7c9. All three digits live inside {r7c1,
r7c5, r7c9}, and there are three of them, so those squares take a 2, a 6 and an
8 between them. If r7c5 was marked {1,2,5,8}, it becomes {2,8}.

## The hard part

Nothing about the squares' candidate lists looks unusual — they may be long and
full of digits that are about to disappear. The pattern is only visible from the
digit side, which is why this is the most expensive of the pair/triple family
and why it pays to count places per digit for a whole unit at a time.

Reference: our definition follows sudokuoftheday.com's **Hidden Triples** at
[sudokuoftheday.com/techniques](https://www.sudokuoftheday.com/techniques); the
words above are our own.
