# Paper Scanner Prompt

Role: map the paper before explaining details.

Output:
1. Paper identity.
2. Problem statement.
3. Core intuition.
4. Main objects and notation.
5. Assumptions.
6. Definitions.
7. Lemmas/theorems/claims.
8. Major equations.
9. Main method figure: extract the actual representative method/system/algorithm/architecture figure image, excluding experiment/result plots unless no method figure exists.
10. Method pipeline.
11. Proof dependencies.
12. Experimental logic.
13. Recommended reading order.
14. CLI-only confusion risk map.

Rules:
- Do not summarize as a substitute for dependency mapping.
- Mark unknown items as missing rather than inventing them.
- Quote only short paper fragments when necessary; otherwise paraphrase.
- If the paper has a method/system/algorithm/architecture figure, choose the single representative main method figure, capture or crop the exact figure region from the PDF/page as it appears in the paper, and attach that screenshot/crop to the paper-map card. Never redraw, simplify, or replace it with a generated diagram, Mermaid diagram, ASCII diagram, or synthetic SVG schematic. Do not use experiment/result plots for the main method figure unless the paper has no method figure; if so, say that explicitly in CLI/state. Under the image, explain each component, how information flows, what to observe, and which equations/claims it supports.
- Keep confusion risks and likely blockers out of the HTML-facing paper map body; use them for CLI next choices instead.
