# Slide Start Here Writer Prompt

Use this prompt to write the first real Start Here HTML block for slide-based PaperMentor sessions. This prompt is for the agent, not for the final HTML body.

## Goal

Write a finished teaching block that orients the reader before they enter individual slide topics. The output must read like a tutor explaining the conceptual path, not like a planning table, rubric, or metadata dump.

## Required output shape

### `## One-sentence orientation`

Write exactly one natural sentence stating what these slides teach or argue. Name the topic, the learner's before/after state, and the central mechanism or timeline. Do not say “this deck”. Do not forecast later material unless it is explicitly visible in the slides.

### `## Topic timeline map`

Write one `flow:` line that groups the major learning phases. Then write 4–8 natural teaching paragraphs under `###` headings. Each paragraph should explain what changes at that point, why the learner needs it before the next point, and which concrete slide object, example, diagram, or equation should be read first.

Do not write a table. Do not use labeled rubric fields.

### `## Preliminary`

Build the prerequisite ladder needed to read these slides, using the same depth expected in paper mode. Read the detected slide topics and any visible formulas or notation before choosing prerequisites. Do not list broad labels like “probability”, “linear algebra”, “optimization”, “Markov decision processes”, or “reinforcement learning basics” unless you decompose them into the exact smaller ideas these slides require.

Start with a `flow:` line in dependency order. Use phase groups when helpful, e.g. `flow: [interaction] agent → action → observation → reward || [math] random variable → expectation → return`.

Then write natural `### N. concept` blocks. Each block must teach the concept from first principles, give a tiny concrete example, and name the exact slide symbol, equation, diagram, or claim it unlocks. If the slides use mathematical notation, include the relevant LaTeX in the prerequisite block and define every symbol. For example, if a slide uses reward $R_t$, return $G_t$, policy $\pi(a\mid s)$, value $v_\pi(s)$, transition probability $P(s'\mid s,a)$, or an expectation $\mathbb{E}[\cdot]$, teach the minimum math needed to read that notation before using it.

Use equations when they genuinely clarify the slide content. A good block may include a tiny numeric example such as $G_1=1+0.9\cdot2+0.9^2\cdot3=5.23$, or $\mathbb{E}[X]=0.7\cdot10+0.3\cdot0=7$. Keep the final prose smooth: do not render field labels like “Why needed”, “Minimal explanation”, or “Diagnostic check” as headings. Those are internal checks only.

## Hard prohibitions

- Do not output placeholder text such as “Not written yet”.
- Do not leave internal labels or rubric fields in the final HTML body.
- Do not use these field names: “Topic role”, “Build slides folded”, “Likely missing narration”, “Key visual/equation to read”.
- Do not use “deck” in final user-facing prose; say “slides”, “lecture slides”, or “강의자료” when needed.
- Do not invent next-lecture claims or prerequisites not visible in the source.
- Do not summarize slide titles mechanically; teach the conceptual path.
