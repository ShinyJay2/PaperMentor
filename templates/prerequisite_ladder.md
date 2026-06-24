# Prerequisite Ladder

Target: `<paper/note/slide location>`

## Reader starting point

State the lowest assumed knowledge level. If the target uses primitive objects, start from them rather than from graduate-level labels.

## Ordered prerequisite list

First list the exact concepts needed for this target, in dependency order from the most primitive idea upward (e.g. for a quantization paper: bit → binary → vector → real number → dimension → function → encoding/decoding → quantization → lossy compression → expectation → randomized algorithm → MSE → inner product → unbiased estimator → worst-case). Then teach them one by one in that order.

## Ladder

Use numbered concept cards, taught like a patient tutor. Use a table only for very short ladders; wide tables become unreadable in HTML.

For each card include:

- **Concept / tier**
- **Why needed here**
- **Minimal explanation + concrete numeric example** — ground the idea in real numbers, not abstract prose (e.g. 2 bits = `00 01 10 11`; a vector `[1.2,3.5,-0.7]`; MSE `[0.1,-0.1] → 0.01+0.01=0.02`; inner product `[1,2]·[3,4]=11`; an unbiased estimate where `90,110,95,105` average to `100`).
- **Notation or paper object introduced**
- **Used at**
- **Diagnostic check**
- **Next prerequisite**

The ladder must be paper-specific. Do not write “linear algebra” or “probability” unless you decompose it into the exact objects used by the target, such as vector, norm, inner product, random variable, expectation, estimator, mask, patch, encoder, or objective.

## One-sentence reconstruction

Rewrite the target paragraph/equation in one precise sentence the reader can now understand.

## Domain re-translation

Restate that one sentence in the reader's own domain when it helps (e.g. an LLM/embedding framing: “compress a 1536-d float vector to 1–4 bits per value while keeping inner-product/cosine search quality”).

## Next advanced prerequisites

List only the concepts that appear later and are not needed for the current target yet (e.g. norm, stochastic rounding, rate–distortion theory, Johnson–Lindenstrauss, PQ/OPQ, entropy).
