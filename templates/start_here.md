# Start Here

## One-sentence paper model

Write exactly one sentence explaining what the paper is doing. It should name the problem, the object being transformed/predicted/proved, and the main method idea.

## Preliminary

Build the prerequisite concepts the reader needs before entering the sections. This is not a topic list and not extracted keywords. It must read like a tutor explaining the exact background needed for this paper. Start where the genuine difficulty begins for this paper's likely reader, then climb to the paper's notation, method, objective, assumptions, and reconstruction.

Do not write one long prose wall. Separate the needed background into short concept blocks grouped by meaning. Each block should teach one core concept in a few clear paragraphs, use a small example or equation when it helps, and connect the concept to the paper's actual notation, equation, figure, theorem, or claim. End with one precise reconstruction sentence: what the reader should now be able to say about the paper.

Do not use tables. Do not force a fixed ladder, schema, or repeated field labels such as “Why needed”, “Minimal explanation”, “Where it appears”, or “Diagnostic check”. Those are internal checks only.

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

## Term-purpose preview

When introducing major equations, briefly name what the important terms do in the source: what each term measures, penalizes, rewards, constrains, normalizes, or propagates. Keep the full detailed explanation for section-level equation blocks.

## Section navigator seed

List the detected paper sections for the CLI navigator only. Do not render this as explanation prose if it is only a menu.
