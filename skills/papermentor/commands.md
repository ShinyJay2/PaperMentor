# PaperMentor Commands

These are command-like intents for Codex and Claude Code conversations. They define the UX contract for using the skill.

## Interactive session contract

PaperMentor uses one local append-only reading document per paper session:

```text
.papermentor/sessions/<paper-slug>/
  index.html      # single browser-rendered block document
  state.json      # current location, Reading Path, choices
  cards.json      # active cards
  notes.md        # portable Markdown notes
```

Use `scripts/papermentor-session.mjs` when available. The CLI should print a Reading Console after session start, after adding a card, and after interruptions.

```bash
node scripts/papermentor-session.mjs start --title "Paper title" --source "paper.pdf"
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

## `/papermentor start`

Purpose: start or resume an interactive reading session.

Required behavior:

- identify the paper title/source;
- create `.papermentor/sessions/<paper-slug>/index.html`;
- create `state.json`, `cards.json`, and `notes.md`;
- run a first paper map when enough text is available;
- print the Reading Console and next choices.

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
- method pipeline;
- experiment logic if present;
- suggested reading order;
- likely confusion points.

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
