The first technique that removes candidates instead of placing a digit, and the
first that looks at two units at once.

## The rule

Work inside a single box. Find a digit the box still needs, and look at every
square in the box that could still take it. If all of those squares happen to
lie on one line — a single row, or a single column — then wherever the digit
ends up in this box, it is somewhere on that line. The line therefore has its
copy of the digit inside this box, so the digit can be struck out of every
square on that line in the _other two_ boxes.

## A worked example

In box 1 the only squares that can still take a 4 are r2c1 and r2c3. Both sit on
row 2. Box 1 must contain a 4, so row 2's 4 is one of those two squares — which
means the rest of row 2, all six squares in boxes 2 and 3, cannot be a 4. Cross
the 4 out there. Nothing has been placed; the board is simply smaller.

## The direction matters

We use this in the box-to-line direction only, exactly as sudokuoftheday.com
defines it. The mirror-image argument — a digit confined to one box within a
line — is not a separate rung here; it falls out of Multiple Lines, which looks
at a whole band or stack. A box with only _one_ place for the digit is a Hidden
Single, cheaper, so this technique needs at least two.

Reference: our definition follows sudokuoftheday.com's **Candidate Lines** at
[sudokuoftheday.com/techniques](https://www.sudokuoftheday.com/techniques); the
words above are our own.
