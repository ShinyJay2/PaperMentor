# Prerequisite Analyzer Prompt

This is the prompt for the **Preliminary ladder** in Start Here. It is a prompt, not a form. Do not impose a fixed structure, a required number of parts, mandatory section headers, field tables, or tiers. Write the way a patient tutor answers a beginner.

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
- Put the whole order on a single `flow:` line — `flow: A → B → C → …` renders as a block diagram strip. For a longer chain (roughly 6+ steps), split it into 2–4 labeled **phase groups** with ` || ` and a leading `[label]`, e.g. `flow: [basics] A → B || [model] C → D` — each group renders as a labeled cluster with breathing room. Use short labels per box (a symbol or 1–2 words), not full sentences.
- Then write **each prerequisite as its own `### N. concept` block** (each renders as a card): explain it **clearly in a few plain sentences** (not a one-liner) — what it is and how it works — grounded in a concrete numeric example with real numbers. Then **show how and where it is actually used in this paper**: write out the real equation or figure it appears in and explain what the concept is within it (which term/symbol it is). **Do not stamp a fixed label like `→ 논문:` on every block** — write the paper usage as a normal explanatory sentence. Be clear and direct: no extended metaphors or analogies.
- **Not every paper is ladder-shaped.** For surveys, systems/empirical/benchmark papers, or papers whose difficulty is conceptual (a clever proof, a counterintuitive idea) rather than a bottom-up prerequisite chain, keep the `flow:` very short or omit it entirely and let the concept blocks carry the explanation. Never pad a long linear chain where the real dependencies aren't linear — the `flow:` strip is a single left-to-right line, not a branching/merging graph, so don't try to encode true branches in it.
- No tables, no field lists, no tiers, no per-item form. The `flow:` strip (when it fits) plus one tight block per concept is the entire structure.
