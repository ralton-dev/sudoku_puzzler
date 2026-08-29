The Naked Pair inverted: two digits that between them own two squares.

## The rule

Take a unit and count, for each digit it still needs, how many squares could
take it. Find two digits whose candidate squares are the *same* pair of squares.
Those two digits must fill those two squares between them, one each — so there
is no room in either square for anything else, and every other candidate in
those two squares can be erased.

## A worked example

In box 5, the digit 1 can only go at r5c4 or r6c6, and the digit 3 can only go
at those same two squares. Between them the 1 and the 3 use both squares up. If
r5c4 was marked {1,3,7,9} it becomes {1,3}, and r6c6 marked {1,2,3} becomes
{1,3}. Nothing has been placed, but two squares just got much smaller — and they
are now a Naked Pair, which will often clear the rest of the unit as well.

## Why it is called hidden

Unlike a Naked Pair, you cannot spot this by looking at candidate lists: the two
digits are hidden among other candidates in the same squares. You have to count
places per digit rather than digits per place. That extra work is why it sits
well above the Naked Pair in cost, and it is worth doing digit by digit through
a unit rather than trying to see it all at once.

Reference: our definition follows sudokuoftheday.com's **Hidden Pairs** at
[sudokuoftheday.com/techniques](https://www.sudokuoftheday.com/techniques); the
words above are our own.
