# PaperMentor

Turn any research paper into an interruptible understanding session: trace the math, repair confusion, and leave with a mental model you can reconstruct.
Works with Codex as an installable Skill.

PaperMentor. Paper understanding should be debugged, not guessed.

[![Quick Start](https://img.shields.io/badge/Quick%20Start-Install%20Skill-0ea5e9)](#-quick-start)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Codex Skill](https://img.shields.io/badge/Codex-Skill-black)](skills/papermentor/SKILL.md)
[![LaTeX First](https://img.shields.io/badge/Math-LaTeX%20First-8b5cf6)](#-latex-first)
[![Korean Support](https://img.shields.io/badge/Language-English%20%7C%20Korean-f97316)](#-korean-support)
[![Tests](https://img.shields.io/badge/Tests-npm%20test-22c55e)](#-testing)

---

You just opened a dense paper. Equation (3) depends on Definition 2, Lemma 1 silently invokes an assumption from page 4, and the proof says “clearly” right where your understanding breaks. Where do you even start?

PaperMentor is a Codex Skill that turns paper reading into a guided tutoring loop. It scans the paper, exposes definitions and assumptions, explains equations symbol by symbol, traces every derivation step, repairs interruptions, and extracts the final mental model.

> **Do not summarize papers. Debug understanding.**

The goal is not a prettier abstract. The goal is a paper you can reconstruct: problem, intuition, equations, derivations, dependencies, assumptions, methods, and the one-sentence model.

---

## ✨ Features

### Explain equations atomically

Every non-trivial equation is shown first in LaTeX, then explained symbol by symbol: operators, domains, codomains, expectations, norms, constants, index sets, subscripts, and superscripts.

### Trace derivations without jumps

PaperMentor does not skip from one equation to the next. It names the operation, property, theorem, substitution, cancellation, assumption, and validity reason for each transition.

### Map dependencies across the paper

Definitions, lemmas, theorems, algorithms, equations, and major claims get backward dependencies, forward dependencies, missing dependency checks, and a recommended explanation order.

### Handle interruptions mid-reading

Ask “why did the sign flip?” or “where did this assumption come from?” PaperMentor pauses the current location, answers the interruption, identifies the missing dependency, gives a minimal example, reconnects to the original line, and resumes.

### Resolve confusion with recursive why

If the first answer still does not land, PaperMentor keeps drilling down until it finds the primitive missing concept: algebra, probability, geometry, optimization, notation, or paper-specific setup.

### Korean support

Ask in Korean and get Korean explanations while equations and notation stay intact in LaTeX.

### Visualization only when it helps

Visualization is used for conceptual confusion — geometry, distributions, random projections, optimization landscapes, algorithm behavior, and experimental trends — not as decoration.

---

## 🚀 Quick Start

### 1. Install the skill

macOS / Linux:

```bash
git clone https://github.com/ShinyJay2/PaperMentor.git
cd PaperMentor
./install.sh
```

Windows PowerShell:

```powershell
git clone https://github.com/ShinyJay2/PaperMentor.git
cd PaperMentor
.\install.ps1
```

The installer copies the canonical `skills/papermentor` entrypoint plus bundled `prompts/`, `templates/`, `examples/`, and `tests/` resources into:

```text
~/.codex/skills/papermentor
```

Override the destination with `CODEX_HOME`:

```bash
CODEX_HOME=/path/to/.codex ./install.sh
```

### 2. Start a paper map

```text
Use $papermentor to scan this paper and create a paper map.
```

PaperMentor identifies the problem, assumptions, notation, definitions, lemmas, theorems, equations, method flow, proof dependencies, and likely confusion points.

### 3. Deep-dive where understanding breaks

```text
Use $papermentor to explain Equation (7) atomically. Do not skip symbols.
```

```text
Use $papermentor to trace the derivation from Eq. (3) to Eq. (5), including substitutions and assumptions.
```

```text
Pause. Why did the sign flip in the second line?
```

### 4. Finish with a mental model

```text
Use $papermentor to extract the final one-sentence mental model and the dependency chain that supports it.
```

---

## 🧭 Command-like UX

PaperMentor uses conversational command intents rather than a separate executable.

| Intent | What it does |
| --- | --- |
| `/papermentor scan` | Build the first paper map |
| `/papermentor prerequisites` | Identify missing background |
| `/papermentor equation` | Explain every symbol and term |
| `/papermentor derive` | Trace equation-to-equation transitions |
| `/papermentor dependencies` | Map backward/forward dependencies |
| `/papermentor proof` | Walk a proof line by line |
| `/papermentor method` | Dissect an algorithm or model |
| `/papermentor confusion` | Answer an interruption and resume |
| `/papermentor why` | Run recursive why until the root gap is found |
| `/papermentor mental-model` | Extract the final reconstructable model |
| `/papermentor visualize` | Plan a support visualization |

Full command contract: [`skills/papermentor/commands.md`](skills/papermentor/commands.md)

---

## 🧮 LaTeX-first

PaperMentor's math policy is strict:

- all non-trivial math must be displayed in LaTeX;
- never use ASCII math as a replacement;
- every equation must be shown before explanation;
- every symbol, subscript, superscript, operator, domain, codomain, expectation, norm, index set, and constant must be explained.

### Atomic equation explanation example

Input:

```text
Explain this equation atomically:
\[
\mathcal{R}(f)=\mathbb{E}_{(x,y)\sim \mathcal{D}}\left[\ell(f(x),y)\right]
\]
```

PaperMentor response shape:

```markdown
\[
\mathcal{R}(f)=\mathbb{E}_{(x,y)\sim \mathcal{D}}\left[\ell(f(x),y)\right]
\]

This equation defines the expected risk of predictor \(f\).

| Symbol | Meaning |
| --- | --- |
| \(\mathcal{R}(f)\) | Risk functional evaluated at predictor \(f\). |
| \(f\) | Function mapping inputs to predictions, often \(f:\mathcal{X}\to\mathcal{Y}\) or \(f:\mathcal{X}\to\mathbb{R}^k\). |
| \((x,y)\sim\mathcal{D}\) | Input-label pair sampled from data distribution \(\mathcal{D}\). |
| \(\mathbb{E}_{(x,y)\sim\mathcal{D}}\) | Expectation over random pairs drawn from \(\mathcal{D}\). |
| \(\ell(f(x),y)\) | Loss comparing prediction \(f(x)\) with target \(y\). |
```

---

## 🧵 Derivation trace example

```markdown
Start:
\[
\|a-b\|_2^2=(a-b)^\top(a-b)
\]

Next:
\[
\|a-b\|_2^2=a^\top a-2a^\top b+b^\top b
\]

Transition:
- **What changed:** the quadratic product was expanded.
- **Operation:** distribute transpose and multiplication.
- **Property used:** bilinearity of the dot product and \(a^\top b=b^\top a\) for real vectors.
- **Substitution:** none.
- **Cancellation:** none.
- **Assumption invoked:** \(a,b\in\mathbb{R}^d\), so inner products are scalars.
- **Why valid:** scalar transposes equal themselves, giving \(-a^\top b-b^\top a=-2a^\top b\).
```

More: [`examples/derivation_trace_example.md`](examples/derivation_trace_example.md)

---

## 🔗 Dependency trace example

```markdown
Claim: Theorem 3 follows from Lemma 1 and Assumption A2.

Backward dependencies:
1. Definition 1 introduces \(\epsilon\)-stability.
2. Assumption A2 bounds \(\|x\|_2\le R\).
3. Lemma 1 converts the norm bound into a Lipschitz bound.

Forward dependencies:
1. Theorem 3 justifies Algorithm 1's update rule.
2. Equation (12) uses Theorem 3 to bound regret.
3. Section 5 uses the regret bound to interpret experiments.

Missing dependency check:
- The proof also uses convexity of \(\ell\), but convexity is not listed in the theorem statement.
```

More: [`examples/dependency_trace_example.md`](examples/dependency_trace_example.md)

---

## ⏸️ Interruptible reading

```text
User: Pause. Why did the sign flip in the second line?
```

PaperMentor's response contract:

1. pause the current location;
2. answer the question;
3. identify the missing dependency;
4. give a minimal example;
5. reconnect to the original equation or sentence;
6. resume from the exact location.

```markdown
Paused at Eq. (8), transition from line 1 to line 2.

The sign flips because the proof moves the term from the left side to the right side of the equality.

Minimal example:
\[
a+b=c
\]
Subtract \(b\) from both sides:
\[
a=c-b
\]

Missing dependency: algebraic isolation by applying the same operation to both sides.

Reconnection: Eq. (8) performs the same operation with \(\lambda\|w\|_2^2\). We now resume at Eq. (8), line 2.
```

---

## 🇰🇷 Korean support

If the user asks in Korean, PaperMentor explains in Korean while preserving equations and notation in LaTeX.

```text
질문: Equation (4)의 \(\mathbb{E}_{x \sim p_{\text{data}}}\)가 무슨 뜻인지 설명해줘.
```

```markdown
먼저 식을 그대로 보겠습니다.

\[
\mathcal{L}(\theta)=\mathbb{E}_{x \sim p_{\text{data}}}\left[-\log p_\theta(x)\right]
\]

- \(\mathcal{L}(\theta)\): 파라미터 \(\theta\)에 대한 손실 함수입니다.
- \(x \sim p_{\text{data}}\): 데이터 분포 \(p_{\text{data}}\)에서 샘플 \(x\)를 뽑는다는 뜻입니다.
- \(\mathbb{E}_{x \sim p_{\text{data}}}\): 그 샘플링 과정에 대한 평균입니다.
```

More: [`examples/korean_equation_explanation.md`](examples/korean_equation_explanation.md)

---

## 🖼️ Visualization example

Visualization is only a support tool for conceptual confusion. Every visualization plan must include a question, concept, visual encoding, what to observe, conclusion, and limitation.

```markdown
Question: Why does projecting high-dimensional vectors preserve pairwise distances approximately?
Concept: Random projection / Johnson-Lindenstrauss intuition.
Visual encoding: Scatter points in \(\mathbb{R}^2\), project to a random 1D line, and draw before/after pairwise distance bars.
What to observe: Nearby points tend to remain nearby, but some distortion appears.
Conclusion: Random projection trades exact geometry for controlled distortion.
Limitation: A 2D-to-1D sketch illustrates distortion qualitatively; it does not prove the high-dimensional concentration bound.
```

---

## 🧠 Under the Hood

### Modular tutor prompts

PaperMentor is split into specialized prompt modules:

| Module | Role |
| --- | --- |
| `paper-scanner` | Build the paper map |
| `prerequisite-analyzer` | Find missing background |
| `equation-analyzer` | Explain one equation atomically |
| `derivation-tracer` | Reconstruct skipped transitions |
| `dependency-tracer` | Map backward and forward dependencies |
| `proof-analyzer` | Walk proof lines and hidden assumptions |
| `method-analyzer` | Dissect algorithms, objectives, and model flow |
| `confusion-resolver` | Repair interruptions and resume reading |
| `mental-model-extractor` | Compress understanding into a reconstructable model |
| `visualization-planner` | Plan conceptual support visuals |

### Templates that force structure

Templates in [`templates/`](templates/) keep outputs concrete: equation cards, derivation traces, dependency traces, proof walkthroughs, method dissections, confusion responses, recursive why ladders, mental models, and visualization cards.

### Checklists that fight handwaving

The [`tests/`](tests/) directory contains human-review checklists for LaTeX quality, atomic equation explanation, derivation tracing, dependency tracing, no-handwave behavior, Korean support, and visualization quality.

---

## 🧪 Testing

Run structural validation:

```bash
npm test
```

The validator checks:

- required repository files;
- skill frontmatter;
- command-to-prompt/template coverage;
- README policy phrases;
- visualization contract consistency;
- temp install smoke for bundled `prompts/`, `templates/`, `examples/`, and `tests/`.

For release checks, also run:

```bash
node --check scripts/validate.mjs
npm pack --dry-run
```

---

## 📁 Repository Layout

```text
papermentor/
  README.md
  SKILL.md
  install.sh
  install.ps1
  package.json
  prompts/
  skills/papermentor/
  templates/
  examples/
  tests/
```

The root repository is the open-source project. `skills/papermentor/` is the canonical installed skill entrypoint. Installers copy that entrypoint plus bundled resources into your Codex skills directory.

---

## 🤝 Contributing

Contributions are welcome if they improve paper understanding rather than add product sprawl.

1. Fork the repository.
2. Create a focused feature branch.
3. Update the relevant prompt, template, example, and checklist together.
4. Run `npm test`.
5. Open a pull request explaining which understanding failure mode your change fixes.

Please do not add blog export, reviewer simulation, or quiz generation to v1. See [`CONTRIBUTING.md`](CONTRIBUTING.md).

---

## 🗺️ Roadmap

### v1

- Interactive paper map
- Atomic equation explanations
- Derivation tracing
- Dependency tracing
- Proof walkthroughs
- Method dissection
- Confusion repair and recursive why
- Korean/English support
- Mental model extraction
- Visualization planning for conceptual support

### Not in v1

- Blog export
- Reviewer simulation
- Quiz generation

### Future candidates

- Local PDF section locator helpers
- Citation graph import helpers
- Notebook-based visualization snippets
- Persistent reading session state

---

Stop skimming papers blind. Start debugging understanding.

MIT License © PaperMentor contributors
