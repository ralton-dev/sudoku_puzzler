The first technique that reaches across the whole board rather than working
inside one unit or one band.

## The rule

Pick a digit. Find two rows in which that digit has exactly **two** possible
squares, and in which those two squares sit in the *same two columns*. The four
squares form the corners of a rectangle. Each row must place the digit in one of
its two corners, and the two rows cannot both choose the same column — so
whichever way they fall, one corner in each column is taken. Both columns
therefore have their copy of the digit inside the rectangle, and the digit can be
struck from every other square in those two columns.

It works with rows and columns swapped, too: two columns each with two places
for the digit, lining up in the same two rows, clears those two rows.

## A worked example

The 3 of row 3 can only be at r3c1 or r3c8, and the 3 of row 6 can only be at
r6c1 or r6c8. Either the 3s take r3c1 and r6c8, or they take r3c8 and r6c1.
Column 1 and column 8 both get one, so every other 3 in columns 1 and 8 — r2c1,
say — can go.

## A caution

A perfectly good X-Wing often eliminates nothing at all, because the other
squares in those columns have no candidate for the digit anyway. Keep looking.

Reference: our definition follows sudokuoftheday.com's **X-Wing** at
[sudokuoftheday.com/techniques](https://www.sudokuoftheday.com/techniques); the
words above are our own.
