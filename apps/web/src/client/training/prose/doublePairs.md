The first technique that reasons about three boxes at once, and the strictest
shape on the ladder.

## The rule

Take a band (three boxes side by side) or a stack (three boxes stacked), and one
digit. Look at two of the three boxes. If each of those two boxes has exactly
**two** places for the digit, and each box's two places sit on two _different_
lines of the chute, and both boxes use the _same_ two lines — that is the
pattern. Two boxes cannot both put the digit on the same line, so between them
they take one line each: both of those lines are spoken for. The third box's
digit is therefore forced onto the one remaining line, and the digit comes out
of the third box's squares on the other two lines.

## A worked example

In the middle stack, the top box can only take its 2 at r1c4 or r3c6, and the
middle box only at r4c6 or r6c4. Both boxes are confined to columns 4 and 6, one
square on each. Whichever way round they fall, columns 4 and 6 are used up, so
the bottom box must place its 2 in column 5 — and every candidate 2 it holds in
columns 4 and 6 can be erased.

## Strictly two pairs

We accept only the literal two-and-two shape. Anything looser — more candidates,
or spread unevenly — is Multiple Lines, the next rung, which costs more.

Reference: our definition follows sudokuoftheday.com's **Double Pairs** at
[sudokuoftheday.com/techniques](https://www.sudokuoftheday.com/techniques); the
words above are our own.
