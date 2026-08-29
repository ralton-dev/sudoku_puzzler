An X-Wing one line wider: three rows, three columns, and the same argument.

## The rule

Pick a digit and three rows in which it is confined, between them, to just three
columns. Each row contributes two or three candidate squares — never more, and
never outside the three columns. Three rows each need the digit once, and no two
of them can use the same column, so the three rows take the three columns
between them: every one of those columns has its copy of the digit inside the
pattern. The digit can then be struck from every other square in those three
columns. As with the X-Wing, the whole thing works transposed as well.

## A worked example

The 7 of row 1 sits only in columns 2 and 5, the 7 of row 4 only in columns 5
and 8, the 7 of row 9 only in columns 2 and 8. Three rows, three columns
{2,5,8}, a closed loop. Whichever way the loop turns, columns 2, 5 and 8 each
receive one of those three 7s, so a 7 anywhere else in those columns — r6c5,
say — is impossible.

## What it is not

If the three rows only manage to cover *two* columns, that is an X-Wing with a
spare row, and the cheaper rung has already taken it. Rows contributing two
candidates rather than three are normal; the pattern does not need to be full.

Reference: our definition follows sudokuoftheday.com's **Swordfish** at
[sudokuoftheday.com/techniques](https://www.sudokuoftheday.com/techniques); the
words above are our own.
