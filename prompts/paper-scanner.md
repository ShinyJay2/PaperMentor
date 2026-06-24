# Paper Scanner Prompt

Role: create the HTML-first reading room before section-level tutoring.

Output for the first HTML block:
1. Paper identity.
2. One-sentence paper model: exactly one sentence stating what the paper does.
3. Core intuition.
4. Main objects and notation.
5. Assumptions.
6. Definitions.
7. Lemmas/theorems/claims.
8. Major equations.
9. Representative method figure: extract the actual representative method/system/algorithm/architecture figure image (excluding experiment/result plots unless no method figure exists), then read it element by element — every box, arrow, line, shape, and every equation/symbol printed inside the figure — and explain it under the image with the fixed schema below.
10. Method pipeline.
11. Proof dependencies.
12. Experimental logic.
13. Recommended reading order.
14. Detailed prerequisite ladder: the beginner-facing sequence of exact concepts, notation, math objects, metrics, assumptions, and source-specific reconstruction needed before reading sections. This must read like a tutor explaining what the reader must know first, not like extracted keywords.
15. Detected section navigator: section titles, section-local equations, definitions, claims, and recommended dynamic choices for CLI only.

Rules:
- Do not summarize as a substitute for dependency mapping.
- Mark unknown items as missing rather than inventing them.
- Quote only short paper fragments when necessary; otherwise paraphrase.
- If the paper has a method/system/algorithm/architecture figure, choose the single representative method figure, capture or crop the exact figure region from the PDF/page as it appears in the paper, and attach that screenshot/crop to the paper-map card. Never redraw, simplify, or replace it with a generated diagram, Mermaid diagram, ASCII diagram, synthetic SVG schematic, or any non-paper figure substitute. Do not use experiment/result plots for the representative figure unless the paper has no method figure; if so, say that explicitly in CLI/state. Then **open the cropped figure image and write the explanation from what is literally drawn in it**, never from the caption or generic priors. Under the image, use the fixed schema `Concept / method role`, `How to read it`, `Parts to identify`, `In-figure math / symbols`, `Flow / sequence`, `What to observe`, and `Equations / claims it supports`. Make it specific to this exact figure: `How to read it` names every labelled box/module/object and what each is; `Parts to identify` enumerates every arrow, line, shape, color, plate/loop, axis, and legend and what each encodes; `In-figure math / symbols` transcribes in LaTeX every equation and symbol printed inside the figure and defines each one (say so if none appear); `Flow / sequence` walks the arrows in execution order, naming the quantity each arrow carries and the transformation each box applies. Never write generic reading advice like “follow the arrows” or “read left to right before the math” — that is not a usable explanation. Do not display provenance filler such as “Exact crop of …” or raw PDF-extracted caption text; if a caption is used, make it the paper figure identity or conceptual role.
- Keep confusion risks and likely blockers out of the HTML-facing paper map body; use them for CLI next choices instead.

- The preliminary ladder must be paper-specific and prerequisite-first. Infer the ladder from the paper's problem statement, representative method figure, notation, and key equations. For each concept, write a plain-language explanation, a tiny example, the notation it unlocks, and where it appears. Never stop at broad labels like “linear algebra/probability/optimization/transformers”; decompose them into the exact objects this paper uses. Never output only paper-specific labels like a method acronym; explain the lower-level concepts that make the acronym readable.

- Before claiming the paper map is complete, verify that the representative figure block uses an attached crop/screenshot file from the paper. If you cannot crop the actual figure, do not use Mermaid or any substitute; leave the figure slot empty and state the extraction blocker in CLI/state only.


HTML-first rules:
- Write the substantive paper start into `index.html` as a `Start Here` block before giving explanations in CLI.
- The CLI should show only the HTML path and detected section choices.
- Detect paper sections and section-local objects so the user can branch like an interactive reading novel.
- When a section is selected, generate dynamic choices from that section's actual equations, definitions, claims, algorithms, proof steps, figures, framing concepts, and citations.
- Introduction choices should come from motivation, conceptual blockers, and key framing sentences.
- Related Work choices should follow cited papers/references and compare the method families named in the section.
- Method choices should expose equations, propositions, assumptions, derivation transitions, and algorithm steps.
- Always include `Ask anything about <section>` and `Chat about this section`.
- Never put long explanations in CLI; append them to HTML blocks.
