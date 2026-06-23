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

Use `scripts/papermentor-session.mjs` when available. The CLI should print a Reading Console after session start, after adding a card, and after interruptions.

```bash
node scripts/papermentor-session.mjs start --title "Paper title" --source "paper.pdf" --sections "1 Introduction|2 Method" --body-file start.md --figure-file figure-1.png
node scripts/papermentor-session.mjs status --session paper-title
```

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
2. Render a first `Start Here` block in `index.html` containing one sentence about what the paper does, the actual representative figure crop, and detailed preliminaries.
3. Print only the HTML path and section choices in CLI.

Branching navigator behavior:

- First menu: detected paper sections.
- Section menu: `Decode key equations`, `Trace derivations`, `Connect dependencies`, `Resolve confusion`, and section-specific questions.
- Mode menu: dynamically detected objects inside the selected section, e.g. `Explain Eq. (1) pushforward symbol by symbol`, `Trace Eq. (4) → Eq. (6)`, or `Build dependency chain for Proposition 3.1`.
- Result: chosen explanations are appended to the same `index.html` as blocks. CLI output stays short and navigational.



## Conversation promotion

Codex decides whether a turn belongs in the polished HTML report. Do not ask after every conversation. Use this policy:

- Always preserve useful reading context in `turns.jsonl` with `/papermentor turn`.
- Auto-promote to `cards.json`/`index.html` when the answer repairs paper understanding: equations, derivations, dependencies, proofs, methods, representative figures, assumptions, recursive why, or final insight.
- Do not promote setup/meta/tooling chatter, casual chat, file-path questions, duplicates, or shallow confirmations.
- Honor explicit overrides: `save this`, `pin this`, `add this to report`, `이 답변 저장해` promote; `don't save this`, `off the record`, `문서에는 넣지 마` do not promote.
- Promoted conversation blocks must include the user question, paper location, missing dependency when applicable, answer, paper reconnection, and resume point.


## `/papermentor start`

Purpose: start or resume an interactive reading session.

Required behavior:

- identify the paper title/source;
- create `.papermentor/sessions/<paper-slug>/index.html`;
- create `state.json`, `cards.json`, and `notes.md`;
- render a first `Start Here` HTML block immediately when `--body-file`/`--body` is provided; use `--figure-file` for the exact representative paper figure crop when present;
- print the HTML path and detected section choices, not an explanation.

Recommended helper call after scanning the PDF:

```bash
node scripts/papermentor-session.mjs start \
  --title "<paper title>" \
  --source "<pdf path or URL>" \
  --sections "1. Introduction|2. Background|3. Methods|4. Experiments" \
  --body-file start-here.md \
  --figure-file figure-1-method-crop.png
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
- explanation under the figure: components, flow/sequence, what to observe, and supported equations/claims;
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
- line-by-line proof table;
- dependencies used per line;
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

## `/papermentor choose`

Purpose: continue from a numbered menu choice.

Required behavior:

- map the number to the latest `state.json.nextChoices`;
- preserve current location unless the choice moves it;
- add or update the relevant card in `cards.json`;
- regenerate the same `index.html`;
- print a new Reading Console.

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
