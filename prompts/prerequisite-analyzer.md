# Prerequisite Analyzer Prompt

This is the prompt for the **Preliminary** section in Start Here. It is a teaching prompt, not a rigid form: do not impose tables, field labels, tiers, or a required number of parts. Write the way a patient tutor answers a beginner. Do not write one long prose wall; separate the needed background into short concept blocks grouped by meaning.

The reader is asking, in their own words, something like:

> "내가 이걸 완벽히 이해하려면 필요한 사전지식을 싹 다 알려줘. 특히 비트(bit)가 뭔지, 그런 것부터 설명해줘."
>
> "Tell me all the background I need to fully understand this — starting from the very basics, like what a bit even is."

Answer that question. Concretely:

- List the concepts the reader must know to read THIS exact source, in dependency order, up to the source's own notation and key equations. **Calibrate the floor to this paper's actual reader** — do not spend rungs on things they already know. Start where the genuine difficulty begins and focus on the **non-trivial, load-bearing, paper-specific** ideas the source introduces or relies on. For a specialist paper (e.g. a SOTA ML method), assume basic vectors / probability / sampling and begin at the harder constructions; only drop to elementary concepts when the paper's likely reader would actually need them.
- Then teach each item, one at a time, in that order. Explain it **clearly in a few sentences** (not a one-liner) — what it is and how it works — and ground it in a **concrete example with real numbers**, not abstract prose. Explain **how and where the concept is actually used in this paper**: bring in the real equation or figure it appears in and say what the concept *is within* it (which term, symbol, or part) — not just a "see Eq. (n)" pointer.
- Finish when the reader could now read the target paragraph/equation and give a **one-sentence reconstruction** of it in their own words.

The flavor that works — for a **beginner-aimed** reading of a quantization paper, the rungs might be:

bit → binary string → vector → real number → dimension → function → encoding/decoding → quantization → lossy compression → expectation → randomized algorithm → MSE → inner product → unbiased estimator → worst-case analysis

…and each rung is taught from zero — *2 bits = `00 01 10 11`*; *a vector `[1.2,3.5,-0.7]`*; *MSE `[0.1,-0.1] → 0.01+0.01=0.02`*; *inner product `[1,2]·[3,4]=11`*; *an unbiased estimator where `90,110,95,105` average to `100`* — then tied back to the paper's $Q:\mathbb{R}^d\to\{0,1\}^B$, distortion, $\mathbb{E}_Q[\cdot]$.

Let the **source and its audience** decide the rungs, including where the ladder starts. A graduate-level method paper should skip the trivial rungs above and instead dwell on its own hard, novel ideas (e.g. a generative-modeling paper: pushforward $f_\#p$ → training-time distribution evolution → drift/vector field → fixed-point & equilibrium → kernel mean-shift → attraction−repulsion → stop-gradient objective → one-step inference). Don't pad with broad labels ("linear algebra", "probability", "self-supervised learning"), and don't pad with concepts the paper's reader already owns. The goal: the reader studies the list top-to-bottom and can then read the paper.

## Rendering (keep it exactly this light)

Structure the output only this much — no more:

- Title the section **Preliminary** (not "Preliminary ladder", not "예비 사다리").
- Separate the explanation into concept blocks by meaning. Each block should teach one core concept clearly in a few plain sentences, ground it in a concrete numeric or symbolic example when useful, and show how it is used in this paper by naming the exact equation, figure, symbol, theorem, or claim it unlocks.
- **Not every paper is ladder-shaped.** For surveys, systems/empirical/benchmark papers, or papers whose difficulty is conceptual rather than bottom-up, group the blocks by the way the reader will actually understand the source.
- No tables, no field lists, no tiers, no per-item form. Keep the blocks natural and readable; do not force a fixed ladder or schema.
