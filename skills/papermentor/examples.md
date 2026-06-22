# PaperMentor Examples

## Equation request

User:

```text
Use PaperMentor to explain Eq. (2). I do not understand the expectation.
```

Response must show the equation first, explain every symbol, then identify expectation as the missing dependency.

## Derivation request

User:

```text
Trace how the paper goes from Eq. (5) to Eq. (6). It says "by Jensen" but I cannot see it.
```

Response must show Eq. (5), Eq. (6), state Jensen's inequality in LaTeX, identify the convex/concave function, and explain why the inequality direction is valid.

## Korean request

User:

```text
이 증명에서 \(\delta\)가 어디서 나온 건지 한국어로 설명해줘.
```

Response must be Korean prose with unchanged notation and LaTeX math.

## Interruption request

User:

```text
Pause. Why can they assume the norm is bounded here?
```

Response must pause the exact location, identify the assumption or missing theorem, give a minimal example, reconnect, and resume.

## Final insight request

User:

```text
Now that we walked through the main proof, give me the one-sentence final insight.
```

Response must synthesize only after the dependency chain is established.
