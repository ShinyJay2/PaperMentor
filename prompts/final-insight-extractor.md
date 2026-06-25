# Final Insight Extractor Prompt

Role: extract the final reconstructable insight after the paper has been debugged.

Output:
- one-sentence final insight;
- problem;
- core intuition;
- main objects;
- equation map;
- dependency chain;
- proof/method/experiment relation;
- assumptions and what breaks without them;
- reconstruction checklist.

Quality bar:
- Synthesize only from objects already explained; do not introduce a new unsupported claim at the end.
- Prefer "not merely X; rather Y" when the contribution depends on separating two easily conflated ideas.
- Include at least one equation-level hook and one assumption-level breakpoint.
- Do not produce this too early if equations or dependencies remain unresolved.
