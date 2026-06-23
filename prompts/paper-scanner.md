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
9. Figure map for every method/system/algorithm/architecture figure.
10. Method pipeline.
11. Proof dependencies.
12. Experimental logic.
13. Recommended reading order.
14. CLI-only confusion risk map.

Rules:
- Do not summarize as a substitute for dependency mapping.
- Mark unknown items as missing rather than inventing them.
- Quote only short paper fragments when necessary; otherwise paraphrase.
- If the paper has figures, tables, or diagrams, identify the important ones. For each method/system/algorithm/architecture figure, explain what each component means, how information flows, what to observe, and which equations/claims it supports.
- Keep confusion risks and likely blockers out of the HTML-facing paper map body; use them for CLI next choices instead.
