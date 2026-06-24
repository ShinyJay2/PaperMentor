# Start Here

## One-sentence paper model

Write exactly one sentence explaining what the paper is doing. It should name the problem, the object being transformed/predicted/proved, and the main method idea.

## Preliminary ladder

Build the prerequisite concepts the reader needs before entering the sections. This is not a topic list and not extracted keywords. It must read like a tutor explaining the exact background needed for this paper. Start from primitive concepts when needed, then climb to the paper's notation, method, objective, assumptions, and reconstruction.

First list the prerequisites in dependency order, then teach each one from zero, in that order, like a patient tutor. Use numbered concept cards. For every card include:

- **Why needed here:** why this concept is required for this paper.
- **Minimal explanation + concrete numeric example:** plain language grounded in real numbers, not abstract prose (e.g. 2 bits = `00 01 10 11`; a vector `[1.2,3.5,-0.7]`; MSE `[0.1,-0.1] → 0.01+0.01=0.02`; inner product `[1,2]·[3,4]=11`; an unbiased estimate where `90,110,95,105` average to `100`).
- **Notation / paper object it unlocks:** exact symbols, variables, figures, equations, or claims.
- **Where it appears:** section, figure, equation, algorithm, theorem, or claim.
- **Diagnostic check:** one question the reader should now be able to answer.

Do not stop at broad labels like “linear algebra”, “probability”, “optimization”, “self-supervised learning”, or “transformers”. Decompose them into the exact concepts used here. Do not output only paper-specific labels like a model acronym; first explain the prerequisites that make that label readable. After the cards, reconstruct the target paragraph/problem in one precise sentence, re-translate it into the reader's domain (e.g. an LLM/embedding framing), and name what to study next.

Example shape for a quantization paper:

1. Bit → binary string → vector → $\mathbb{R}^d$ → function $Q$ → quantization → lossy compression → expectation → MSE → inner product → unbiased estimator → final reconstruction.

Example shape for a self-supervised vision paper:

1. Image → patch → vector/embedding → representation → encoder → context block → target block → mask/index set $B_i$ → predictor → loss/objective → $\ell_2$ norm → moving-average target encoder → final reconstruction.

## Figure explanation under image

Attach the exact screenshot/crop of the representative method/system/algorithm/architecture figure from the PDF/page. Prefer a method-section figure over an introduction/result figure in paper mode. Do not redraw it. Do not use Mermaid. The renderer moves this section under the image. Keep the labels exactly; do not paste raw PDF-extracted caption text as the explanation.

Open the cropped image and write the explanation from what is literally drawn in it. Be specific to this exact figure: `How to read it` names every labelled box/object and what each is; `Parts to identify` enumerates every arrow, line, shape, color, axis, and legend and what each encodes; `In-figure math / symbols` transcribes in LaTeX every equation and symbol printed inside the figure and defines each one (say so if none appear); `Flow / sequence` walks the arrows in order, naming the quantity each arrow carries and the transformation each box applies, ending at the output or loss. Never write generic reading advice such as “follow the arrows” or “read left to right” — telling the reader to move their eyes is not an explanation.

- Figure / location:
- Concept / method role:
- How to read it:
- Parts to identify:
- In-figure math / symbols:
- Flow / sequence:
- What to observe:
- Equations / claims it supports:

## Section navigator seed

List the detected paper sections for the CLI navigator only. Do not render this as explanation prose if it is only a menu.
