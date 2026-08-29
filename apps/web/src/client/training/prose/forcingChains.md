The only rung that reasons forwards instead of matching a shape — and the only
one where you follow a consequence rather than see a pattern.

## The rule

Find a square with exactly two candidates. You do not know which it is, but you
know it is one of them, so try each in turn. Put the first digit in, then solve
onwards using only the two single techniques — a square with one candidate left,
or a digit with one place left in a unit — and note every square you fill. Then
start again from the original square with the other digit and do the same. If
both branches end up putting the **same digit in the same square**, that square
is settled: it takes that digit either way, so you can write it in without ever
learning what the starting square was.

## A worked example

r2c2 is {4,9}. Say 4: r2c7 becomes 9, then r5c7 becomes 1, then r5c3 becomes 6.
Say 9 instead: r3c2 becomes 4, then r5c2 becomes 2, then r5c3 becomes 6 again.
Both roads reach a 6 at r5c3, so r5c3 is a 6.

## This is not guessing

You are holding both branches at once, not picking one and hoping. Two rules
keep it honest here. Chains use singles only — a chain needing an X-Wing halfway
is not one a person could follow — and a branch that runs into a contradiction
is abandoned rather than used: that deduction is Nishio, a different technique,
and this rung is not paid for it.

Reference: our definition follows sudokuoftheday.com's **Forcing Chains** at
[sudokuoftheday.com/techniques](https://www.sudokuoftheday.com/techniques); the
words above are our own.
