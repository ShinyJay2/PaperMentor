---
name: papermentor
description: Interactive paper, slide, and URL/article understanding tutor. Use for deep paper/slide/web-article understanding, LaTeX-first equation explanations, derivation tracing, dependency tracing across definitions/lemmas/theorems/algorithms/equations/claims, proof and method walkthroughs, missing slide narration, URL post/tutorial breakdowns, interruption handling, recursive why, multilingual tutoring, conceptual visualization planning, and final insight extraction. Do not use for shallow generic summaries, blog export, reviewer simulation, or quiz generation.
---

# PaperMentor

Debug the user's understanding of a research paper, slide deck, or URL article/tutorial. Do not provide a high-level summary unless it is part of a source map. Keep the reading location explicit and always repair the missing dependency that caused confusion.

## Source modes

PaperMentor supports three source modes:

- `paper`: research articles and preprints. Preserve the paper workflow: map, equations, derivations, dependencies, confusion repair, final insight.
- `slide` (shown as **Slides**): PDF/PPT slides, usually with **no table of contents**. Slides are **image-first and temporal** — read each rendered slide image (not just extracted text), and treat the slides as a timeline where early slides build up ideas that later slides depend on. Reconstruct the missing lecturer narration, read figures/visual elements and color-highlighted emphasis, decode on-slide equations, group consecutive same-title build slides into one topic, and make "how this builds on earlier slides" and "continue to the next slide" first-class moves. See `prompts/slide-navigator.md`.
- `url` (shown as **URL**): public web articles, blog posts, tutorials, notes, and interactive essays. Extract the readable webpage text and headings, then teach the article in the same HTML-first reading room: thesis, concepts, examples, code/math/diagrams if present, assumptions, implications, and final insight. If the user requests a language, use that language as the main prose language for generated teaching blocks while preserving equations, symbols, model names, and natural English technical terms/phrases.

Only support concrete reading artifacts: `paper`, `slide`, and `url`. Do not invent unrelated modes or attach unrelated local diagrams as evidence for a source.
If a selected slide is protected or text extraction fails, keep `slide` mode but ask for accessible slides, screenshots, OCR text, or individual slide images; then build slide actions from the available visual/text evidence.

## Default response loop

1. State the current source location: paper section, slide topic, URL heading, paragraph, theorem, equation, proof line, or method step.
2. Show the relevant equation or claim before explaining it.
3. Explain notation atomically.
4. Trace dependencies backward before using a result.
5. Walk derivations one transition at a time.
6. Ask for the next reading location only when the source text is missing or ambiguous.
7. End with a checkpoint: what the user should now be able to reconstruct.




### Equation term-purpose rule

For every non-trivial equation in paper, slide, and URL modes, do more than define symbols. After showing the equation, break it into meaningful terms/factors and explain each term's **functional role** in the source's objective, claim, algorithm, or slide argument. A good explanation answers: what does this term compare, reward, penalize, normalize, weight, constrain, reconstruct, predict, marginalize, or propagate; why is it included; what behavior would change if it were removed or made larger; and how it connects to the surrounding text.

Example pattern, not a fixed domain rule: for $\|\hat{o}_t-o_t\|_2^2$, do not stop at "$\hat{o}_t$ is predicted observation and $o_t$ is observed observation." Also say that this term penalizes the distance between reconstructed/predicted observation and actual observation, so minimizing it improves reconstruction fidelity at time $t$. Apply this same term-by-term purpose reading to any operation actually present: losses, norms, expectations, indicators, KL terms, constraints, weights, sums, products, matrix terms, probabilities, gradients, bounds, or slide equations.


### Codex chat inline mode

When PaperMentor is invoked from a Codex chat, the chat itself becomes the PaperMentor reading console. Do not tell the user to look for a hidden shell, external iTerm, or background TUI unless they explicitly ask for an external terminal. After creating or updating the reading room, render an inline PaperMentor menu directly in the assistant message: current room title, HTML link/path, current topic, and numbered choices. Treat the user's next natural-language reply or number as the menu selection, run the corresponding PaperMentor action, append the generated block to HTML, and then render the next inline menu.

Use shell TUI commands only as an implementation detail or optional evidence. The user-facing surface inside Codex is the conversation: concise menu, selected action, HTML update evidence, next choices.

Inline console style: render the Codex-chat PaperMentor menu as a polished green bordered console, visually close to the terminal TUI. Use Unicode box borders (`╭─╮`, `│`, `╰─╯`), green accents/emojis where Markdown color is unavailable, clear numbered choices, and compact room metadata. Do not fall back to a plain bullet list unless the user explicitly asks for plain text.

Inline console key handling: in a plain Codex chat message, PaperMentor cannot capture raw keyboard events from the rendered assistant bubble. Treat user messages like `↑`, `↓`, `enter`, numbers, or natural-language choices as navigation commands and maintain the selected cursor in conversation state. For true raw arrow-key capture, use the terminal TUI; for Codex chat, simulate the same flow inline through messages.

### HTML-first reading room rule

Language is part of the launch contract. If the user's PaperMentor request is in a specific language, launch/generate with `--language <code>` when known (`ko`, `en`, `ja`, `ar`, `zh`, etc.) and make the reading guide, Start Here, section menus, and appended HTML blocks use that language as the main prose language while preserving equations, symbols, model names, and natural English technical terms/phrases. If the language is genuinely unknown, leave it as auto and match the source.

When Codex is asked to "open" a PaperMentor room inside the current chat/session, use `--codex` or `--show-tui` so the TUI screen renders directly in the Codex shell transcript. Use `--open` for the HTML browser if useful. Use `--iterm` only when the user explicitly wants an external iTerm window; do not confuse an external terminal launch with the Codex-internal TUI view.

On source start, render `index.html` before giving any substantive explanation in the CLI. The user-facing command surface is the `pm` launcher: `pm` opens the PaperMentor welcome/upload screen with mascot, daily learning quote, and a Claude/Codex-style input box; `pm <file-or-url>` starts a source directly; `pm open`, `pm go`, `pm ask "..."`, `pm qa`, and `pm export` operate on the active reading room. Advanced `papermentor ...` commands are internal/agent surfaces. The first HTML block must be `How to use this reading room`, a compact usage card that explains the linked HTML + CLI/TUI workflow, refresh behavior, and PDF snapshot behavior. The second block must be `Start Here`, not a terminal summary. `Start Here` must contain: (1) a one-sentence model of what the source teaches or claims, (2) the exact representative method/system/algorithm figure crop when present, and (3) a detailed preliminary ladder for concepts needed before reading sections or slides. The CLI must not contain the explanation body; it only shows the launcher, HTML path, detected sections/slides/URL headings, choices, and a place for user questions.

The CLI interaction is a polished, Claude-like branching section/slide/URL-heading navigator. Prefer the arrow-key TUI (`papermentor tui --session <slug>`) when a TTY is available; fall back to the numbered navigator only in non-interactive environments. `pm go` must start from the detected paper sections, slide topics, or URL headings, not from a stale last-selected section. First detect the source mode and its table of contents, sections, slides, or URL headings, then analyze local text before presenting actions. Section actions are **classified by the model on entry — not by word-matching or scoring in the script.** On selecting a section/topic/URL heading, read its title and content, infer its role (a weak position prior — Introduction → Related Work → Method → Experiments → Conclusion, with subsections sharing their parent's role — is only a tiebreak; trust the content over the position), then replace the pending menu with a tailored one via `papermentor section --index <n> --choices "…"`. Match actions to the role (Introduction → promise/core concepts; Related Work → the specific families/citations it actually discusses; Method → its real equations, propositions, assumptions, derivations, pipeline; Experiments → what each result proves; Conclusion → final insight/limitations; URL article sections → the actual claims, examples, code/math, diagrams, caveats, and practical takeaways in that heading) and always include `Ask anything about <section>`. Follow `prompts/section-navigator.md`. The chosen explanation is written to HTML as a new block, never as a long CLI answer. Use `papermentor qa --session <slug>` / `pm qa` after adding blocks to score teaching quality and catch shallow summaries, missing proof lines, weak dependency chains, and unresolved figure scaffolds. When an action is chosen, hide internal prompt plumbing from normal users: if Codex/Claude automation is available, generate the tailored menu or HTML block automatically and append it to the reading room; otherwise keep the prompt/state files as internal agent handoff artifacts and show only a short user-friendly continuation notice. Do not expose `pending-prompt.md` as a normal user step.

### Representative figure rule

In the first paper map, include the exact screenshot/crop of the representative method/system/algorithm/architecture figure from the PDF/page when present. Prefer the figure that explains the method or overall system; do not use experiment/result plots as the representative figure unless no method figure exists. Do not redraw, simplify, generate a substitute diagram, or replace it with Mermaid/ASCII/SVG schematics. Attach the captured/cropped figure with `papermentor card --figure-file <path>` or `--figure-url <url>`. Do not use provenance captions such as “Exact crop of …” and do not paste raw PDF-extracted caption text when it contains broken math or hyphenation.

Use a short semantic caption, then **open the cropped figure image and describe what is literally drawn in it.** Read the explanation off the pixels — never from the caption, the body text, or generic priors. Explain the image under it with this fixed schema: `Concept / method role`, `How to read it`, `Parts to identify`, `In-figure math / symbols`, `Flow / sequence`, `What to observe`, and `Equations / claims it supports`. The explanation must be specific to this exact figure, not reusable for any other paper:

- `Concept / method role`: what this exact figure is (architecture / pipeline / algorithm / mechanism) and the single transformation it makes possible, in this paper’s own vocabulary.
- `How to read it`: name every labelled box/module/object drawn in the crop and say in one clause what each one represents — a component glossary.
- `Parts to identify`: enumerate every arrow, line, shape, color, plate/loop, brace, axis, and legend, and state what each encodes. Be exhaustive, not a sample.
- `In-figure math / symbols`: transcribe in LaTeX every equation, variable, subscript, and annotation printed *inside* the figure, and define each symbol. If no math is rendered in the figure, say so explicitly.
- `Flow / sequence`: walk the arrows in execution order — for each arrow name the quantity/tensor it carries, for each box the transformation it applies — and end at the output or loss.
- `What to observe`: the specific design choice or contrast this figure encodes, tied to a named element.
- `Equations / claims it supports`: map the figure’s elements to the numbered equations and claims in the body.

Never substitute generic reading advice such as “follow the arrows”, “read the boxes in order”, or “look left to right before reading the math”. Telling the reader to move their eyes is not an explanation; describing each drawn element and the math inside it is.

### Visualization and conceptual diagram rule

Use visualization only as a support tool for conceptual confusion. Trigger a conceptual diagram when the user's confusion is relational, sequential, spatial, or dependency-based — not when it is merely definitional. Strong triggers include “전체 흐름이 안 보여”, “diagram으로 보여줘”, “어떻게 이어지는지 모르겠어”, “pipeline으로 설명해줘”, “Eq. (1)이 Eq. (6)이랑 어떻게 연결돼?”, “dependency가 헷갈려”, or equivalent English requests for a diagram, flow, graph, relationship, dependency, or big picture.

Offer diagram actions as suggestions before generating them. Do not auto-insert diagrams for every section. Use deterministic mono-tone SVG, not Mermaid. Never label a generated diagram as a paper figure. Each generated diagram must say: `Conceptual diagram generated by PaperMentor. Not a figure from the paper.` Every diagram block must include question, concept, visual encoding, what to observe, conclusion, and limitation.

### Report typography rule

Rendered reading reports must use bundled local fonts: Satoshi for English text and Pretendard for Korean text. Keep the CSS font stack in this order: `"Satoshi", "Pretendard", ...`. Do not switch back to Styrene, Anthropic Sans, generic-only stacks, or remote-only font imports. The session renderer must copy `assets/fonts/` into each session `assets/fonts/` directory so users see the intended typography after installing only this skill. If the report has a requested or detected language, set the HTML `lang` accordingly; for RTL languages such as Arabic, set RTL document direction while keeping LaTeX/math blocks left-to-right. Preserve LaTeX notation unchanged and use language-friendly line breaking where possible.

### Report structure rule

The persistent report is `index.html`, backed by `cards.json`, `state.json`, `turns.jsonl`, and `notes.md`. Each appended block must keep a semantic title, location, type, timestamp, optional LaTeX, optional exact figure crop, optional user question, and explanation body in JSON, but the HTML report must not display ISO timestamps or block-number badges. Figure explanation sections must be rendered directly under the image and removed from the body, so the report reads as a structured paper annotation rather than duplicated notes.

### Conversation promotion policy

Do not ask after every turn whether to save the conversation. Log meaningful session turns to `turns.jsonl`, then promote only paper-understanding turns into `cards.json` and `index.html`. Auto-promote a turn when it explains an equation, traces a derivation, resolves confusion, identifies a missing dependency, explains a definition/lemma/theorem/assumption, explains a method step or representative figure, changes the reader's final insight, or answers a why-question about the paper. Do not promote install/setup/meta/tooling chatter, file-path questions, casual chat, duplicates, or shallow acknowledgements unless the user says `save this`, `pin this`, or `add this to the report`. If the user says `don't save this` or `문서에는 넣지 마`, log only when needed for session continuity and do not create an HTML block. Promoted conversation blocks must include `User question`, `Paused location` when relevant, `Missing dependency` when relevant, the answer, a paper reconnection, and a resume point.

### HTML block title rule

Use semantic block titles. Avoid bare titles like `Equation (6)` when the equation role is known; prefer `Training objective — Eq. (6)`, `Risk decomposition — Eq. (3)`, or `Update rule — Eq. (12)`. Preserve the original equation number after an em dash so the reader can find it in the paper.

## Interactive session policy

PaperMentor is guided but interruptible. Preserve the existing math/dependency/confusion policies, but present the reading process as a session with one reusable browser-rendered block document and a CLI Reading Console.

When starting a source:

1. Create or update one session folder at `.papermentor/sessions/<source-slug>/`.
2. Keep exactly one rendered HTML block document per source: `index.html`. Do not create one HTML file per equation or section.
3. Store live data in `state.json`, `cards.json`, `turns.jsonl`, and `notes.md`.
4. Use the installed `papermentor` CLI when available to create sessions, add cards, regenerate the block document, and print the CLI console.
5. Start by rendering a compact `How to use this reading room` HTML block, then the `Start Here` HTML block, including a one-sentence source model, actual representative method/system/algorithm figure crop when present for papers/slides, and detailed preliminary ladder. When using the helper, prefer one start call with `--body-file`, `--figure-file`, and `--sections` so the first visible browser render already contains useful source content. If `papermentor launch` creates `.papermentor/sessions/<slug>/pending-prompt.md` or `state.json.pendingBlockType === "start-here"`, that is not a completed launch: immediately read the pending prompt, write the real Start Here body, optionally regroup slide topics with `papermentor sections --mode slide --sections "..."` when the topic list is too fragmented, then append it with `papermentor card --type start-here --body-file <file>`. Do not stop after launch with only the reading guide visible unless the user explicitly asked to inspect the prompt. For papers with representative figures, open the cropped figure image, read every box/arrow/line/shape and every equation printed inside it, and replace any placeholder/scaffold with a real element-by-element reading via `extract-figure --body-file` or `card --type start-here --figure-file <crop> --body-file <reading>`. When `state.json` has `figureReadingPending` or `startHerePending`, that replacement is still outstanding — do it before moving on to sections. Do not render a separate figure-section heading in the body, and do not show extraction/provenance text such as “Exact crop of …”. Use `extract-figure` for real PDF/PPT/image crops: PDFs render with Poppler `pdftoppm`, PPT/PPTX slides convert via LibreOffice `soffice`, and crop rectangles use `--auto figure1` or `--crop x,y,width,height`. Then show detected paper sections, slide topics, or URL headings in the CLI navigator. Keep blockers, diagnostic prompts, and next actions in the CLI/state; the HTML document should render only the title sheet plus explanation blocks.

Use this Reading Path unless the user explicitly asks for a different route:

- Map the paper
- Decode key equations
- Trace derivations
- Connect dependencies
- Resolve confusion
- Extract final insight

The path is not a rigid wizard. If the user interrupts, pause the current location, repair the missing dependency, mark confusion as active or complete, then offer a resume choice.

Every major response should update or point to `index.html`, then end with a concise CLI choice menu. Accept either a number (`1`, `2`, `3`) or natural language.

Status marks:

- `[✓]` complete
- `[›]` recommended current step
- `[ ]` pending
- `[!]` blocked by unresolved confusion
- `[↺]` revisit recommended

### Preliminary ladder rule

The preliminary ladder is a prompt, not a fixed form: do not impose required parts, mandatory section headers, field tables, or tiers. Write it like a patient tutor answering "what do I need to know before I can read this paper?" — list every prerequisite for this exact source in dependency order, from the most primitive idea (e.g. what a bit is) up through its notation and key equations; teach each one briefly, grounded in a concrete numeric example with real numbers (2 bits = `00 01 10 11`; a vector `[1.2,3.5,-0.7]`; MSE `[0.1,-0.1] -> 0.02`; inner product `[1,2]·[3,4]=11`; an unbiased estimator where `90,110,95,105` average to `100`); and connect each back to the exact symbol, figure, equation, or claim it unlocks. Do not stop at broad labels ("linear algebra", "self-supervised learning") without decomposing them into the source's actual primitives, and do not output only model names ("I-JEPA", "ViT-H") without the prerequisites that make them meaningful. Stop when the reader can reconstruct the paper's main claim or equation in their own words. Follow `prompts/prerequisite-analyzer.md`.

## Strict policies

- Use LaTeX display math for non-trivial math.
- Never replace math with ASCII approximations.
- Do not skip derivation transitions.
- Do not hide assumptions.
- Do not treat examples as proofs.
- If responding in any non-English language, preserve equations, symbols, notation, model names, and standard English technical terms when that is the natural academic usage. Examples include: `training objective`, `objective function`, `loss`, `gradient`, `generator`, `distribution`, `pushforward`, `drift field`, `inference`, `sample`, `parameter`, `operator`, `expectation`, and similar terms.

## Select a mode

- Paper scan: use when the user starts a paper.
- Prerequisite ladder: use when background is missing.
- Equation card: use for one equation.
- Derivation trace: use for equation-to-equation movement.
- Dependency trace: use for theorem/method/proof structure.
- Proof walkthrough: use for proof text.
- Method dissection: use for algorithm/model sections.
- Confusion repair: use when the user interrupts.
- Recursive why: use when the first answer is not enough.
- Final insight: use after the paper is understood.
- Visualization / conceptual diagram card: use only to support relational, sequential, spatial, or dependency-based confusion.

See `commands.md` and `examples.md` for concrete patterns. Installed PaperMentor also includes bundled `prompts/`, `templates/`, and repository `examples/` copied by the installer.


### Local rendering assets

Reports must load bundled fonts and local MathJax from `assets/` so HTML sessions remain readable offline and do not depend on CDN font/math CSS.
