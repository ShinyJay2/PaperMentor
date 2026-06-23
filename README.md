<div align="center">

# PaperMentor

### Upload a paper. Understand it in 30 minutes.

Not a summarizer — an **AI Agent Skill** that debugs equations, derivations, dependencies, and conceptual confusion until you can reconstruct the paper yourself.

<img src="assets/papermentor-demo.svg" alt="PaperMentor converts a paper excerpt into a paper map, equation card, derivation trace, and final insight" width="920" />

[![Install](https://img.shields.io/badge/Install-one%20line-0ea5e9)](#install)
[![Codex](https://img.shields.io/badge/Codex-Skill-black)](skills/papermentor/SKILL.md)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-Skill-6b4fbb)](https://code.claude.com/docs/en/skills)
[![Math](https://img.shields.io/badge/Math-rendered%20LaTeX-8b5cf6)](#what-the-output-looks-like)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**Do not summarize papers. Debug understanding.**

</div>

---

## Why PaperMentor exists

Most paper tools compress the paper. PaperMentor does the opposite: it slows down at the exact line where understanding breaks.

A useful reading session should leave you able to reconstruct:

- the problem and core intuition,
- every major equation,
- every derivation transition,
- the dependency chain between definitions, assumptions, lemmas, methods, and claims,
- and the final insight in one sentence.

---

## See it work

PaperMentor follows one repeatable loop:

<table>
<tr>
<td width="25%" valign="top">

### 1. Upload
Paste the paper, PDF text, or a target section.

`Use $papermentor to scan this paper.`

</td>
<td width="25%" valign="top">

### 2. Map
Find the problem, notation, assumptions, claims, and equations.

`Build the paper map.`

</td>
<td width="25%" valign="top">

### 3. Debug
Pick the blocker: equation, derivation, proof, method, or dependency.

`Explain Equation (7) atomically.`

</td>
<td width="25%" valign="top">

### 4. Reconstruct
Resume from the paused line and extract the final insight.

`Extract the final insight.`

</td>
</tr>
</table>

Interrupt anytime: `Pause. Why did the sign flip here?` PaperMentor answers the missing concept, reconnects it to the original line, and continues from the exact location.

---

## Install

Codex:

```bash
curl -fsSL https://raw.githubusercontent.com/ShinyJay2/PaperMentor/main/install.sh | bash
```

Claude Code:

```bash
curl -fsSL https://raw.githubusercontent.com/ShinyJay2/PaperMentor/main/install.sh | bash -s claude
```

Both:

```bash
curl -fsSL https://raw.githubusercontent.com/ShinyJay2/PaperMentor/main/install.sh | bash -s all
```

Windows PowerShell:

```powershell
iwr -useb https://raw.githubusercontent.com/ShinyJay2/PaperMentor/main/install.ps1 | iex
```

Install locations:

```text
Codex:       ~/.codex/skills/papermentor
Claude Code: ~/.claude/skills/papermentor
```

---


## Append-only reading document

PaperMentor is guided but interruptible. For each paper, it keeps one local HTML document that grows block by block instead of creating a dashboard or a pile of separate HTML files:

```text
.papermentor/sessions/<paper-slug>/
  index.html      # rendered paper blocks, appended one section at a time
  state.json      # current location, Reading Path, choices
  cards.json      # paper map, equation, derivation, dependency cards
  notes.md        # portable Markdown notes
```

The browser view is intentionally minimal: a quiet paper title sheet followed by rendered explanation blocks. The first paper-map block should include the actual main method figure image when the paper has one. No left panel, no product header, no app chrome, and no “likely blockers” lists in HTML. Blockers and next actions stay in the terminal. The terminal stays lightweight and choice-driven:

```text
Reading Path
  [✓] Map the paper
  [›] Decode key equations
  [ ] Trace derivations
  [ ] Connect dependencies
  [ ] Resolve confusion
  [ ] Extract final insight

Choose next:
  [1] Explain Training objective — Eq. (6) symbol by symbol
  [2] Trace Drift update — Eq. (4) → Training objective — Eq. (6)
  [3] Explain why stopgrad is used
  [4] Explain what V_{p,q} means visually
  [5] I’m confused — ask me diagnostic questions
```

Open `index.html` for rendered LaTeX. Answer with a number or interrupt naturally. Use semantic equation block titles such as `Training objective — Eq. (6)` so the block is readable and still traceable to the paper.

---

## Try the sample paper

Use the included sample to see the full interaction shape before trying a real paper:

```text
Use $papermentor on demo/sample-paper.md. Start with a paper map, then explain the population risk equation atomically, trace why empirical risk is introduced, and finish with the final insight.
```

Reference outputs live in [`demo/outputs`](demo/outputs): paper map, equation card, derivation trace, and final insight.

---

## Command intents

- `scan` — produce the paper map before details, including the exact cropped/screenshot main method/system/algorithm figure when present, with explanation underneath.
- `equation` — explain every symbol and operator after showing the equation.
- `derivation` — trace each transition without skipped algebra.
- `dependency` — reveal what a claim depends on and what depends on it.
- `interrupt` — pause, repair confusion, reconnect, and resume.
- `final-insight` — compress the full reconstruction into the takeaway.

Full command contract: [`skills/papermentor/commands.md`](skills/papermentor/commands.md).

---

## What the output looks like

### Rendered equation explanation

PaperMentor shows the equation before explaining it:

$$
\mathcal{R}(f)=\mathbb{E}_{(x,y)\sim\mathcal{D}}\left[\ell(f(x),y)\right]
$$

- $\mathcal{R}(f)$ — risk functional evaluated at predictor $f$.
- $(x,y)\sim\mathcal{D}$ — an input-label pair sampled from distribution $\mathcal{D}$.
- $\mathbb{E}_{(x,y)\sim\mathcal{D}}$ — expectation over that sampling process.
- $\ell(f(x),y)$ — loss comparing prediction $f(x)$ with target $y$.

### Trace a derivation

Start:

$$
\|a-b\|_2^2=(a-b)^\top(a-b)
$$

Next:

$$
\|a-b\|_2^2=a^\top a-2a^\top b+b^\top b
$$

Transition:

- **Operation:** expand the quadratic product.
- **Property:** bilinearity and $a^\top b=b^\top a$ for real vectors.
- **Assumption:** $a,b\in\mathbb{R}^d$.
- **Why valid:** real inner products are scalar and symmetric.

### Map a dependency chain

- **Backward dependencies:** Definition 1 → Assumption A2 → Lemma 1 → Theorem 3
- **Forward dependencies:** Theorem 3 → Equation (12) → experiment interpretation
- **Missing dependency check:** convexity of $\ell$ is used but not stated
- **Recommended explanation order:** Definition 1, Assumption A2, Lemma 1, Theorem 3

### Plan a visualization

Every visualization plan includes a **question**, **concept**, **visual encoding**, **what to observe**, **conclusion**, and **limitation**.

| Field | Example |
| --- | --- |
| Question | Why do random projections approximately preserve distances? |
| Concept | Johnson-Lindenstrauss intuition |
| Visual encoding | Points, projection line, before/after distance bars |
| What to observe | Most relative distances remain similar with controlled distortion |
| Conclusion | Random projection trades exact geometry for compact representation |
| Limitation | The sketch is intuition, not the concentration proof |

---

## Project anatomy

```text
prompts/              specialized tutor modes
skills/papermentor/   installable Skill entrypoint
templates/            output structures
examples/             concrete behavior examples
demo/                 sample paper and reference outputs
tests/                human review checklists
assets/               README and social preview images
```

Validation:

```bash
npm test
```

The validator checks required files, skill frontmatter, command coverage, visualization policy consistency, sample-demo artifacts, and install-smoke coverage for both Codex and Claude Code.

---

## Product boundaries

PaperMentor focuses on understanding work: equations, derivations, dependencies, interruptions, recursive why, visual support, and final insight extraction.

Deliberately out of scope: blog export, reviewer simulation, and quiz generation.

Planned extensions: local PDF section locator helpers, citation graph helpers, notebook visualization snippets, and persistent reading sessions.

---

## Contributing

High-value contributions make papers easier to reconstruct, not just easier to summarize. Start with [`CONTRIBUTING.md`](CONTRIBUTING.md), then add or improve one of:

- equation cards for difficult notation,
- derivation traces with no skipped transitions,
- dependency traces across definitions and claims,
- confusion-repair examples,
- visualization plans for geometry, distributions, optimization, or experiments.

---

<div align="center">

Stop skimming papers blind. Start debugging understanding.

MIT License © PaperMentor contributors

</div>
