# PaperMentor Commands

These are command-like intents for Codex and Claude Code conversations. They define the UX contract for using the skill.

## Interactive session contract

PaperMentor uses one local append-only reading document per paper session:

```text
.papermentor/sessions/<paper-slug>/
  index.html      # single browser-rendered block document
  state.json      # current location, Reading Path, choices
  cards.json      # promoted study blocks
  turns.jsonl     # raw-ish user/assistant turn log
  notes.md        # portable Markdown notes
```

Use the installed `papermentor` CLI when available. The CLI should print a Reading Console after session start, after adding a card, and after interruptions.

```bash
pm
pm "paper-or-slides.pdf"
pm open
pm go
pm ask "What is confusing here?"
pm qa
pm export
papermentor launch "https://arxiv.org/pdf/2602.04770" --open
papermentor start --title "Paper title" --source "paper.pdf" --sections "1 Introduction|2 Method" --body-file start.md --figure-file figure-1.png
papermentor status --session paper-title
papermentor qa-batch --sessions "paper-a|paper-b|paper-c"
papermentor figure-audit --recent 10
papermentor proof-audit --sessions "proof-paper-a|proof-paper-b"
papermentor doctor
```

User-facing surface:

- `pm` opens the Claude/Codex-style main menu.
- `pm <file-or-url>` starts a reading room.
- `pm open` opens the latest/current HTML.
- `pm go` resumes the arrow-key reading room.
- `pm ask "..."` asks about the current topic and appends the answer to the reading room when agent automation is available.
- `pm qa` scores generated HTML blocks for teaching quality and flags shallow/missing structure.
- `pm export` exports the latest/current room.

Advanced `papermentor ...` commands remain available for agents and scripts, but normal users should not need to memorize them.

Reading Path:

```text
[✓] Map the paper
[›] Decode key equations
[ ] Trace derivations
[ ] Connect dependencies
[ ] Resolve confusion
[ ] Extract final insight
```

Status marks: `[✓]` complete, `[›]` recommended current step, `[ ]` pending, `[!]` blocked, `[↺]` revisit.

Always offer numbered choices. Accept either the number or a natural-language interruption.

## HTML-first navigator contract

Do not explain the paper in the CLI. The CLI is a controller; `index.html` is the reading surface.

On paper start:

1. Detect the paper title, sections/table of contents, major equations, and representative method/system/algorithm figure.
2. Render a first `How to use this reading room` block in `index.html` explaining the HTML + CLI/TUI workflow, refresh behavior, and PDF snapshot behavior.
3. Render `Start Here` immediately after it, containing one sentence about what the paper does, the actual representative figure crop, and detailed preliminaries.
4. Print only the HTML path and section choices in CLI.
4. Launch or offer the arrow-key TUI when the terminal supports it.

Branching navigator behavior:

- First menu: detected paper sections.
- Section menu: dynamically generated from the selected section text, not a fixed global checklist.
  - Introduction: concepts, framing claims, motivation, and “why this paper exists.”
  - Related Work: cited methods/papers, family comparisons, and citation-following actions.
  - Method sections: equations, propositions, assumptions, algorithms, figures, derivation transitions, and compact method overview.
  - Experiment sections: metrics, tables/figures, claims supported by results, and limitations.
- Every section menu must include exactly one open question action: `Ask anything about <section>`.
- When section content or user confusion is relational, sequential, spatial, or dependency-based, include a visual repair action such as `Draw method pipeline`, `Map equation dependencies`, or `Build concept prerequisite graph`.
- Mode/item menu: dynamically detected objects inside the selected section, e.g. `Explain Eq. (1) pushforward symbol by symbol`, `Trace Eq. (4) → Eq. (6)`, or `Build dependency chain for Proposition 3.1`.
- Result: chosen explanations are appended to the same `index.html` as blocks. CLI output stays short and navigational.



## Conversation promotion

Codex decides whether a turn belongs in the polished HTML report. Do not ask after every conversation. Use this policy:

- Always preserve useful reading context in `turns.jsonl` with `/papermentor turn`.
- Auto-promote to `cards.json`/`index.html` when the answer repairs paper understanding: equations, derivations, dependencies, proofs, methods, representative figures, assumptions, recursive why, or final insight.
- Do not promote setup/meta/tooling chatter, casual chat, file-path questions, duplicates, or shallow confirmations.
- Honor explicit overrides: `save this`, `pin this`, `add this to report`, `이 답변 저장해` promote; `don't save this`, `off the record`, `문서에는 넣지 마` do not promote.
- Promoted conversation blocks must include the user question, paper location, missing dependency when applicable, answer, paper reconnection, and resume point.



## Source modes

PaperMentor supports two modes: `paper` and `slide`. Omit `--mode` for normal use; the helper detects the mode from the file and extracted text. PaperMentor is optimized for concrete reading artifacts, not general webpages. Never attach unrelated local diagrams as evidence for a source.

```bash
papermentor start --title "Source title" --source source.pdf
papermentor analyze --session source-title --paper-text-file source.txt
papermentor tui --session source-title
```

Mode-specific dynamic menus:

- `paper`: section actions expose equations, derivations, dependencies, method figures, experiments, ask/chat.
- `slide`: slide actions expose missing narration, visual element explanation, slide transitions, equations/notation, ask/chat.

If a slide PDF is protected or not text-extractable, stay in `slide` mode and use screenshots, OCR text, or user-provided slide images as the source evidence.

## `/papermentor doctor`

Purpose: diagnose local runtime parity before PDF/PPTX extraction.

Required behavior:

- check `pdftoppm` for PDF page rendering;
- check LibreOffice (`soffice` or `libreoffice`) for PPT/PPTX conversion;
- check ImageMagick (`magick` or `convert`, with macOS `sips` as a local crop renderer) for crop extraction;
- check Python `pptx` / apt `python3-pptx` availability for PPTX fixture support;
- print install guidance for missing tools and exit non-zero when extraction dependencies are incomplete.

Example:

```bash
papermentor doctor
```

## `/papermentor launch`

Purpose: start a polished reading room from one URL or local source file.

Required behavior:

- accept arXiv PDF/abs URLs, local PDFs, PPT/PPTX slides, and text fixtures;
- download URL sources into `.papermentor/sources/` when needed;
- extract title and authors from the first page when possible;
- never display local source paths under the report title; show authors instead;
- detect source mode and section/slide boundaries;
- create `.papermentor/sessions/<slug>/index.html` immediately;
- attach the representative method/system figure or representative slide when auto-crop succeeds;
- write `.papermentor/sessions/<slug>/crop-preview.html` with full-page and auto-crop candidates so users can recrop visually;
- print the HTML path, crop-preview path, and TUI command.

Example:

```bash
papermentor launch https://arxiv.org/pdf/2602.04770 --open
```

Manual crop-preview / recrop:

```bash
papermentor preview-crops --session drifting-models --source paper.pdf --page 1
papermentor extract-figure --session drifting-models --source paper.pdf --page 1 --crop 120,80,900,360 --title "Figure 1 — Method"
```


## `/papermentor qa`

Purpose: score the current reading room's generated HTML blocks for teaching quality before export or handoff.

Behavior:

- evaluates each promoted block in `cards.json`;
- flags shallow summaries, unresolved scaffolds, missing equation/proof anchors, weak proof-line coverage, weak dependency chains, and missing reconstruction checkpoints;
- writes `.papermentor/sessions/<slug>/quality-report.json`;
- exits non-zero when `--min <score>` is supplied and the room is below threshold.

Example:

```bash
papermentor qa --session drifting-models
papermentor qa --session drifting-models --min 82
```

## `/papermentor qa-batch`

Purpose: run the same teaching-quality check across multiple paper rooms so product readiness is not based on one cherry-picked session.

Behavior:

- resolves sessions from `--sessions "slugA|slugB"`, `--recent <n>`, or `--all`;
- writes each session's normal `quality-report.json`;
- writes aggregate `.papermentor/quality-batch-report.json`;
- reports aggregate status and exits non-zero when `--min <score>` is supplied and the average falls below threshold.

Example:

```bash
papermentor qa-batch --sessions "turboquant|jepa|causal-graph" --min 82
papermentor qa-batch --recent 8 --json
```

## `/papermentor figure-audit`

Purpose: collect real figure-reading failure cases: tiny/wrong crops, unreadable dimensions, unresolved figure scaffolds, and missing fixed-schema figure readings.

Behavior:

- resolves sessions from `--sessions`, `--recent`, or `--all`;
- inspects attached figure assets in promoted cards;
- flags suspicious crop dimensions/aspect ratios and figure-reading bodies that do not follow the element-by-element schema;
- writes `.papermentor/figure-audit-report.json`.

Example:

```bash
papermentor figure-audit --recent 10
papermentor figure-audit --sessions "paper-a|paper-b" --json
```

## `/papermentor proof-audit`

Purpose: repeatedly verify proof-heavy generated blocks rather than trusting one easy proof example.

Behavior:

- resolves sessions from `--sessions`, `--recent`, or `--all`;
- finds proof blocks plus theorem/lemma/proposition-like blocks;
- applies the proof teaching-quality checks for claim restatement, line-transition microscope coverage, term-level operation audits inferred from the selected proof, domain-specific operations when present, and reconstruction checkpoints;
- writes `.papermentor/proof-audit-report.json`.

Example:

```bash
papermentor proof-audit --sessions "convex-proof|rl-proof|estimator-proof"
papermentor proof-audit --recent 10 --json
```

## `/papermentor export`

Purpose: create a one-file PDF or portable HTML report bundle for download, sharing, or archiving.

Behavior:

- render the current `index.html` first;
- with `--format pdf`, print the report to one local PDF file using Chrome/Chromium/Edge;
- with `--format zip`, zip `index.html`, `assets/`, `cards.json`, `notes.md`, `state.json`, and `turns.jsonl`;
- keep source PDFs out of the export by default;
- after unzip, users open `index.html` in a local browser.

Example:

```bash
papermentor qa --session drifting-models --min 82
papermentor export --session drifting-models --format pdf --output drifting-papermentor-report.pdf --overwrite
papermentor export --session drifting-models --format zip --output drifting-papermentor-report.zip --overwrite
```

## `/papermentor preview-crops`

Purpose: create a visual recrop sheet before attaching a representative source figure.

Required behavior:

- render the selected PDF page or PPT/PPTX slide;
- write `.papermentor/sessions/<slug>/crop-preview.html`;
- write `.papermentor/sessions/<slug>/crop-previews.json`;
- include at least a full-page/full-slide candidate and, when possible, an auto Figure 1 candidate;
- print copy-pasteable `extract-figure --crop x,y,width,height` commands;
- do not add a study block to `index.html` until the user chooses or confirms the crop.

## `/papermentor start`

Purpose: start or resume an interactive reading session.

Required behavior:

- identify the paper title/source;
- create `.papermentor/sessions/<paper-slug>/index.html`;
- create `state.json`, `cards.json`, and `notes.md`;
- render a first `How to use this reading room` HTML block, then a `Start Here` HTML block immediately when `--body-file`/`--body` is provided; use `--figure-file` for the exact representative paper figure crop when present;
- print the HTML path and detected section choices, not an explanation.

Recommended helper call after scanning the PDF:

```bash
papermentor start \
  --title "<source title>" \
  --source "<pdf path or URL>" \
  --sections "1. Introduction|2. Background|3. Methods|4. Experiments" \
  --body-file start-here.md \
  --figure-file figure-1-method-crop.png
```

## `/papermentor analyze`

Purpose: inspect extracted paper text and generate section-specific navigator actions.

Required behavior:

- read the paper text, table of contents, references, and section bodies;
- populate `state.json.paperSections`, `sectionActions`, and `sectionInsights`;
- generate actions from actual section content:
  - concepts and framing in Introduction;
  - citation-following and method-family comparisons in Related Work;
  - equations, propositions, algorithms, and assumptions in Method sections;
  - metrics, tables, and claims in Experiments;
- include `Ask anything about <section>`;
- do not write explanations to CLI or HTML during analysis.

Helper:

```bash
papermentor analyze --session <slug> --paper-text-file paper.txt
```

## `/papermentor tui`

Purpose: run the interactive arrow-key navigator.

Required behavior:

- use ↑/↓ to move, Enter to choose, `/` for ask-anything/chat, and `q` to quit;
- render a polished terminal surface that feels like PaperMentor is actively running;
- keep CLI content navigational only;
- after section selection, show dynamic actions from `state.json.sectionActions`;
- after action selection, set `state.json.selectedAction` so the next explanation can be appended to `index.html`.

Helper:

```bash
papermentor tui --session <slug>
```

## `/papermentor scan`

Purpose: create a paper map.

Required output:

- bibliographic identity if provided;
- problem statement;
- main objects and notation;
- assumptions;
- major definitions;
- lemmas/theorems/claims;
- major equations;
- exact screenshot/crop of the representative method/system/algorithm/architecture figure from the PDF/page, attached with `--figure-file` or `--figure-url`; do not redraw it and do not substitute Mermaid/ASCII/SVG schematics;
- semantic figure caption only if helpful, not provenance text such as “Exact crop of …”;
- explanation under the figure must be read off the cropped image itself and use the fixed labels `Concept / method role`, `How to read it`, `Parts to identify`, `In-figure math / symbols`, `Flow / sequence`, `What to observe`, and `Equations / claims it supports`. It must be specific to this exact figure: name every box/object and what it is, enumerate every arrow/line/shape/axis/legend and what it encodes, transcribe in LaTeX every equation/symbol printed inside the figure, and trace the arrows in order naming the quantity each carries — never generic advice like “follow the arrows with your eyes”;
- method pipeline;
- experiment logic if present;
- suggested reading order;
- likely confusion points for CLI next choices only, not for HTML rendering.

## `/papermentor prerequisites`

Purpose: build a prerequisite ladder.

Required output:

- target concept;
- prerequisites sorted from basic to advanced;
- why each prerequisite is needed;
- minimal explanation;
- paper location where it is used;
- diagnostic question to verify readiness.

## `/papermentor equation`

Purpose: explain one equation atomically.

Required output:

- equation displayed first in LaTeX;
- plain-language role of the equation;
- symbol table;
- domain/codomain table;
- operator explanations;
- assumptions;
- common mistakes;
- reconstruction checkpoint.

## `/papermentor derive`

Purpose: trace a derivation.

Required output for each transition:

- previous equation;
- next equation;
- what changed;
- operation applied;
- property/theorem/definition used;
- substitution;
- cancellation;
- assumption invoked;
- why valid.

## `/papermentor dependencies`

Purpose: trace dependency structure.

Required output:

- item under analysis;
- backward dependencies;
- forward dependencies;
- missing dependency check;
- recommended explanation order.

## `/papermentor proof`

Purpose: walk a proof line by line.

Required output:

- theorem/claim statement;
- proof strategy;
- notation and object definitions;
- line transition microscope: previous line, next line, and the exact operation(s) between them;
- term-level operation audit inferred from the selected proof itself, without forcing the proof into a predefined operation menu;
- hidden assumptions;
- minimal example when abstract;
- why the final line proves the claim.

## `/papermentor method`

Purpose: dissect a method, architecture, or algorithm.

Required output:

- input/output contract;
- variables and parameters;
- algorithm steps;
- objective or loss;
- training/inference distinction;
- dependency on equations/theorems;
- failure modes;
- method-level final insight.

## `/papermentor confusion`

Purpose: handle interruption.

Required output:

- paused location;
- direct answer;
- missing dependency;
- minimal example;
- reconnection to original equation/sentence;
- exact resume point.

## `/papermentor why`

Purpose: recursive why.

Required output:

- current confusion statement;
- first-level answer;
- root dependency probe;
- next why layer;
- stop condition when the primitive concept is reached;
- reconstruction checkpoint.

## `/papermentor final-insight`

Purpose: extract the final insight.

Required output:

- one-sentence final insight;
- problem;
- core intuition;
- object map;
- equation map;
- dependency chain;
- method/proof/experiment relation;
- what would break if assumptions fail.

## `/papermentor visualize`

Purpose: plan a conceptual visualization.

Required output:

- question;
- concept;
- visual encoding;
- what to observe;
- conclusion;
- limitation of the visualization.

## `/papermentor diagram`

Purpose: generate a deterministic mono-tone SVG conceptual diagram as a visual repair aid.

Trigger only when the confusion is relational, sequential, spatial, or dependency-based:

- user asks for a diagram, graph, flow, pipeline, structure, relationship, dependency map, or big picture;
- Introduction has multiple concepts whose problem → limitation → idea flow is unclear;
- Related Work has many citations or method families;
- Method/Algorithm sections have inputs, outputs, objectives, iterative steps, or algorithms;
- equation-heavy sections need an equation dependency map;
- proof/theorem sections need a proof dependency graph;
- experiments need evidence-flow alignment between metric, figure/table, result, and claim.

Do not trigger for a single definition, one symbol explanation, a short factual citation question, or when the paper's own figure already fully resolves the confusion.

Required output:

- generated SVG in mono-tone paper style;
- explicit label: `Conceptual diagram generated by PaperMentor. Not a figure from the paper.`;
- question;
- concept;
- visual encoding;
- what to observe;
- conclusion;
- limitation.

Helper:

```bash
papermentor diagram \
  --session <slug> \
  --kind method-pipeline \
  --nodes "input|generator|drift field|training objective|updated generator"
```


## `/papermentor sections`

Purpose: populate or refresh the detected paper section navigator.

Required behavior:

- detect section titles from the PDF/table of contents/body headings;
- store them in `state.json.paperSections`;
- print numbered section choices only;
- do not add explanatory HTML blocks.

## `/papermentor section`

Purpose: select one paper section.

Required behavior:

- update `state.json.currentSection`;
- show section-local actions: decode equations, trace derivations, connect dependencies, resolve confusion, ask a question;
- do not explain the section in CLI.

## `/papermentor mode`

Purpose: show dynamic choices inside the selected section.

Required behavior:

- detect equations, definitions, claims, lemmas, algorithms, proof steps, or figures inside the selected section;
- store those items in `state.json.detectedItems`;
- show numbered choices such as `Explain Eq. (1) pushforward symbol by symbol`;
- append explanation to HTML only after the user chooses an item.

## `/papermentor turn`

Purpose: record one user or assistant conversation turn without necessarily adding it to the HTML report.

Required behavior:

- append JSONL to `.papermentor/sessions/<paper-slug>/turns.jsonl`;
- include role, text, location, promotion decision, reason, optional `savedAs`, and timestamp;
- use `--promote` when the turn should be converted into a study block;
- use `--no-promote` for meta/tooling/casual turns.

## `/papermentor promote`

Purpose: convert a useful conversation turn into a study block.

Required behavior:

- create a normal card with `--origin-turn` and `--user-question`;
- keep raw transcript in `turns.jsonl`;
- write only the cleaned learning explanation into `cards.json` and `index.html`;
- never dump the whole chat transcript into the report.

## `/papermentor choose` / `/papermentor run`

Purpose: continue from a numbered menu choice and connect it to the HTML-block runner.

Required behavior:

- map the number to the latest `state.json.nextChoices`;
- preserve current location unless the choice moves it;
- if the choice selects a section/slide, show its dynamic actions;
- if the choice selects an action, generate and append the HTML block automatically when Codex/Claude automation is available; otherwise create the internal block-generation handoff with inferred card type, selected section, equations, concepts, citations, and template path;
- regenerate the same `index.html` without adding placeholder explanation blocks;
- print a polished Reading Console without exposing internal prompt-file paths to normal users.

Example:

```sh
papermentor run --session drifting-models --index 2
```

## `/papermentor extract-figure`

Purpose: extract an actual representative figure/slide crop from a PDF, PPT/PPTX, or image source and attach it to the next HTML block.

Required behavior:

- prefer real source crops over generated diagrams for method/system/algorithm figures;
- for PDFs, render the requested page with Poppler `pdftoppm`;
- for PPT/PPTX, convert through LibreOffice `soffice`, then render the selected slide;
- crop with ImageMagick or macOS `sips` when `--auto figure1` or `--crop x,y,width,height` is provided;
- attach the extracted image as a normal card figure, then open that crop and write the explanation under the image from what is literally drawn — every box, arrow, line, shape, and every equation/symbol printed inside the figure;
- never use Mermaid as a replacement for an actual paper/slide figure.

Example:

```sh
papermentor extract-figure --session drifting-models --source paper.pdf --page 1 --auto figure1 --title "Representative method figure"
```

## `/papermentor render`

Purpose: render or refresh the current session block document.

Required behavior:

- do not create extra HTML files;
- regenerate `.papermentor/sessions/<paper-slug>/index.html`;
- keep LaTeX display math in card data so MathJax can render it in the block document;
- print the block document path.
- keep blockers, diagnostic prompts, and next actions out of `index.html`; those belong in the CLI Reading Console and session state.

## `/papermentor state`

Purpose: show the current Reading Path, location, focus, block document path, and next choices without adding a new explanation.

## `/papermentor pause`

Purpose: handle an interruption while preserving the current reading location.

Required output:

- paused location;
- direct answer;
- missing dependency;
- minimal example;
- reconnection to original equation/sentence;
- resume choices.

## `/papermentor resume`

Purpose: return from an interruption to the exact paused location.

Required behavior:

- restate the saved location;
- explain what dependency was repaired;
- continue with the next Reading Path choice.
