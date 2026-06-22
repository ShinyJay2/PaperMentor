# PaperMentor sample session

Use this file to test the Skill without finding a full paper first.

## Prompt

```text
Use $papermentor on demo/sample-paper.md. Start with a paper map, then explain the population risk equation atomically, trace why empirical risk is introduced, and finish with the final insight.
```

## Expected interaction shape

1. **Paper map** — identify the problem, objects, assumptions, equations, and claims.
2. **Equation card** — show the equation before explaining every symbol and operator.
3. **Dependency trace** — connect $\mathcal{D}$, samples, empirical risk, and generalization.
4. **Interruption repair** — handle questions such as `Pause. Why do we replace expectation with an average?`
5. **Final insight** — compress the reconstruction into one sentence.

## What success looks like

A reader should be able to reconstruct why the paper moves from population risk to empirical risk and what assumption is still missing: the sample must represent the data distribution well enough for empirical performance to say something about population performance.
