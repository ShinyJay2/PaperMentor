<div align="center">

# PaperMentor

### Stop summarizing papers. Start debugging understanding.

Drop a **paper, lecture deck, or technical URL**. PaperMentor opens a local HTML reading room, then helps you reconstruct the hard part: equations, derivations, proofs, figures, slide narration, dependencies, and final insight.

<img src="assets/papermentor-hero.svg" alt="PaperMentor HTML-first reading room for papers, slides, and URLs" width="960" />

[![Install](https://img.shields.io/badge/Install-one%20line-0ea5e9)](#install)
[![Codex](https://img.shields.io/badge/Codex-Skill-black)](skills/papermentor/SKILL.md)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-Skill-6b4fbb)](https://code.claude.com/docs/en/skills)
[![Papers](https://img.shields.io/badge/Papers%20%2B%20Slides%20%2B%20URLs-supported-22c55e)](#what-it-reads)
[![Math](https://img.shields.io/badge/LaTeX-local%20HTML-8b5cf6)](#what-the-output-looks-like)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**Do not summarize papers. Debug understanding.**

**If PaperMentor saves you one painful paper-reading session, star the repo so other researchers can find it.**

</div>

---

## The promise

Most AI reading tools compress a source into a summary. PaperMentor does the opposite: it slows down exactly where understanding breaks.

PaperMentor should leave you able to say:

- what the source is trying to prove, teach, or build,
- what every important symbol means,
- how one equation line turns into the next,
- which definitions, assumptions, lemmas, figures, or examples a claim depends on,
- what a lecturer probably said between dense slides,
- and the final insight in your own words.

---

## Start in one command

```bash
pm <file-or-url>
pm
```

The first command opens a guided terminal launch wizard where you choose mode, language, HTML opening, generation, and whether to enter the arrow-key reading console. Add `--quick` to skip the wizard. The second opens the launcher where you can drop a source or continue the latest room.

## 90-second demo

```bash
# 1. Install for Codex
curl -fsSL https://raw.githubusercontent.com/ShinyJay2/PaperMentor/main/install.sh | bash

# 2. Open the launcher
pm

# 3. Drop a source
# - arXiv PDF
# - local PDF/PPT/PPTX lecture slides
# - technical blog/tutorial URL
```

Or launch with the guided wizard:

```bash
pm https://arxiv.org/pdf/2602.04770
pm https://lilianweng.github.io/posts/2026-06-24-scaling-laws/
pm ./lecture-slides.pdf
```

PaperMentor creates:

```text
.papermentor/sessions/<source>/index.html
```

Open that HTML file and keep it next to the terminal. Each selected action appends one polished explanation block to the same reading room.

See also:

<img src="assets/papermentor-demo.svg" alt="PaperMentor demo flow from source to reading-room blocks" width="820" />

- Demo script: [`docs/demo-script.md`](docs/demo-script.md)
- Sample report: [`demo/report/index.html`](demo/report/index.html)
- Sample outputs: [`demo/outputs`](demo/outputs)

---

## What it reads

| Source | What PaperMentor detects | What you get |
| --- | --- | --- |
| Research papers | title, authors, sections, equations, proofs, method figures | Start Here, preliminaries, equation cards, derivation/proof walkthroughs, dependency traces, final insight |
| Lecture slides | topic ranges, build slides, equations, diagrams, missing narration | topic timeline, slide-range explanations, visual reading, missing lecture narration |
| URLs | article title, headings, code/math/examples, claims | article map, section choices, claim/example/math explanations, caveats |

It is intentionally optimized for concrete learning artifacts, not generic web summaries.

---

## What makes it different

### 1. HTML-first reading room

PaperMentor writes a local report as you learn. It is not a chat transcript. Useful answers become clean blocks in `index.html`; tool chatter stays out.

### 2. Content-adapted choices

The menu is generated from the selected section/slide/URL heading. Method sections expose equations and algorithms. Proof sections focus on line transitions. Slide topics expose missing narration, diagrams, and build-slide flow.

### 3. Line-transition microscope

For proofs and derivations, the goal is not a table of labels. The goal is to explain the primitive operation between lines: substitution, expansion, expectation rewrite, inequality use, limit movement, algebraic rearrangement, or whatever operation the source actually uses.

### 4. Real figures when possible

PaperMentor tries to attach the actual representative method/system figure from the source, then explains how to read it. Conceptual diagrams are clearly labeled as diagrams, not source figures.

### 5. Korean/English tutoring

Ask in Korean, get Korean explanations while preserving notation and standard research terms such as `objective`, `gradient`, `expectation`, `policy`, and `loss` when that is the natural academic usage.

---

## Install

PaperMentor installs the same skill into Codex and/or Claude Code from one manifest-backed installer. Requirements: Node.js 18+ and git on PATH.

Codex only:

```bash
curl -fsSL https://raw.githubusercontent.com/ShinyJay2/PaperMentor/main/install.sh | bash
```

Claude Code only:

```bash
curl -fsSL https://raw.githubusercontent.com/ShinyJay2/PaperMentor/main/install.sh | bash -s -- claude
```

Codex + Claude Code:

```bash
curl -fsSL https://raw.githubusercontent.com/ShinyJay2/PaperMentor/main/install.sh | bash -s -- all
```

Windows PowerShell:

```powershell
iwr -useb https://raw.githubusercontent.com/ShinyJay2/PaperMentor/main/install.ps1 -OutFile install.ps1
.\install.ps1 codex     # or: .\install.ps1 claude / .\install.ps1 all
```

If Codex is installed through npm on Windows and PowerShell can run `codex` but PaperMentor cannot find it, point PaperMentor at the npm shim explicitly:

```powershell
$env:PAPERMENTOR_AGENT = "codex"
$env:PAPERMENTOR_CODEX_BIN = "$env:APPDATA\npm\codex.cmd"
pm https://arxiv.org/pdf/1505.04597
```

Pinned/local install:

```bash
git clone https://github.com/ShinyJay2/PaperMentor.git
cd PaperMentor
./install.sh codex       # or: ./install.sh claude / ./install.sh all
```

Install locations:

```text
Codex:        ~/.codex/skills/papermentor
Claude Code:  ~/.claude/skills/papermentor
CLI aliases:  ~/.local/bin/papermentor and ~/.local/bin/pm
Windows CLI:  ~/.papermentor/bin/papermentor.cmd and ~/.papermentor/bin/pm.cmd
```

Korean user manual:

- PDF: [`docs/PaperMentor_사용설명서_KO.pdf`](docs/PaperMentor_사용설명서_KO.pdf)
- Markdown: [`docs/papermentor-manual.ko.md`](docs/papermentor-manual.ko.md)

---

## Use it

### Agent automation

Inside Codex or Claude Code, PaperMentor uses the active agent to generate section-specific choices and append polished HTML blocks. The local CLI manages the reading room, topic navigation, opening/exporting HTML, and local setup checks.

### Terminal-first

```bash
pm                              # launcher
pm ./paper.pdf                  # auto-detect paper
pm ./slides.pptx --mode slide   # force slide mode
pm https://example.com/post     # URL mode
pm open                         # open latest reading room
pm go                           # continue latest room
pm ask "Why does this equation become an expectation?"
pm export                       # export latest room
```

### Inside Codex or Claude Code

Ask naturally:

```text
Use PaperMentor on this paper and start from the theorem proof.
```

```text
이 강의 슬라이드 PaperMentor로 열고, Bellman equation 들어가기 전에 필요한 개념부터 설명해줘.
```

```text
Use PaperMentor on this Lilian Weng URL and explain the Chinchilla section.
```

---

### Try the sample paper

Use the included sample before trying a real paper:

```bash
pm demo/sample-paper.md
```

Or ask inside Codex/Claude:

```text
Use PaperMentor on demo/sample-paper.md. Explain the population risk equation, trace why empirical risk is introduced, and finish with the final insight.
```

### Useful advanced command

If a paper figure crop looks wrong, inspect candidates without editing the report manually:

```bash
papermentor preview-crops --session <paper-slug> --source paper.pdf --page 1
```

---

## What the output looks like

### Start Here

A compact orientation block with the source thesis, reading path, and only the prerequisites needed for this source.

### Equation card

PaperMentor shows the equation first:

$$
\mathcal{R}(f)=\mathbb{E}_{(x,y)\sim\mathcal{D}}\left[\ell(f(x),y)\right]
$$

Then it explains each symbol and operator:

- $\mathcal{R}(f)$ — risk functional evaluated at predictor $f$.
- $(x,y)\sim\mathcal{D}$ — an input-label pair sampled from distribution $\mathcal{D}$.
- $\mathbb{E}$ — average over repeated draws from that distribution.
- $\ell(f(x),y)$ — penalty for predicting $f(x)$ when the true label is $y$.

### Proof / derivation walkthrough

Instead of “this follows by algebra,” PaperMentor spells out the transition:

```text
Line A: E_tau[p_theta(tau) R(tau)]
Line B: E_tau[nabla log p_theta(tau) R(tau)]

What happened:
1. Differentiate the trajectory probability.
2. Insert the identity ∇p = p∇log p.
3. Recognize the remaining p-weighted sum as an expectation.
4. The environment transition terms vanish from the gradient because they do not depend on theta.
```

### Slide narration

For lecture slides, PaperMentor explains what the instructor likely meant between bullet points, diagrams, and equations, especially when build slides gradually reveal a concept.

### Trace a derivation

PaperMentor should explain every non-trivial move rather than saying “by algebra.” For example, it identifies the operation, the property used, the assumption that makes it legal, and the exact term movement.

### Map a dependency chain

A dependency block connects definitions, assumptions, lemmas, equations, algorithms, figures, and claims in the order needed to reconstruct the argument. It also calls out missing dependencies when the source relies on something unstated.

### Plan a visualization

Visualization support is for relational, sequential, spatial, or dependency-based confusion. Every visualization plan includes a **question**, **concept**, **visual encoding**, **what to observe**, **conclusion**, and **limitation**. Generated diagrams are conceptual aids, not source figures.

### Prerequisite ladder

When background is missing, PaperMentor starts from **primitive vocabulary**, adds concrete examples, gives a diagnostic check, and only then climbs to the paper's notation or slide equation.

---

## Project anatomy

```text
papermentor.manifest.json  install/package manifest
scripts/install.mjs         Codex/Claude installer
scripts/papermentor-session.mjs  local reading-room CLI
prompts/                    specialized tutor prompts
templates/                  output structures
skills/papermentor/         installable skill entrypoint
examples/                   concrete behavior examples
demo/                       sample source and rendered demo report
assets/                     local fonts, MathJax, README SVGs
```

Validation:

```bash
npm test
npm run manifest:check
npm run pack:check
npm run marketplace:check
```

---

## Product boundaries

PaperMentor focuses on understanding work: equations, derivations, proofs, method sections, figures, dependencies, lecture-slide narration, recursive why, and final insight extraction.

Deliberately out of scope: generic blog export, reviewer simulation, quiz generation, and pretending every figure crop or proof explanation is automatically perfect without user review.

## Roadmap

- More robust figure selection across messy PDFs and slide exports.
- Better proof-mode evaluation on proof-heavy papers.
- Marketplace submission packaging for Codex and Claude Code.
- More public demo rooms across ML, economics, math, and systems papers.

---

## How to help

If you want PaperMentor to become the default way researchers read hard technical material:

1. Star the repo.
2. Share one screenshot of a block that helped you understand a paper.
3. Open an issue with a paper/slide/URL that confused the tool.
4. Contribute a prompt, template, or example that makes explanations more reconstructable.

High-value contributions make papers easier to reconstruct, not just easier to summarize.

---

<div align="center">

**Stop skimming papers blind. Debug understanding.**

MIT License © PaperMentor contributors

</div>
