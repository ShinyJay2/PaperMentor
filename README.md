# PaperMentor

> **Debug paper understanding — one equation, dependency, and interruption at a time.**

PaperMentor is an installable Codex Skill for interactive research-paper tutoring. It does **not** turn papers into shallow summaries. It helps a reader reconstruct how the paper works: the problem, the assumptions, the definitions, the derivations, the proofs, the method, and the final one-sentence mental model.

## Why PaperMentor exists

Most AI paper tools answer: “What is this paper about?” PaperMentor answers: “Where exactly did your understanding break?”

Research papers are hard because meaning is distributed across notation, hidden assumptions, theorem dependencies, derivation shortcuts, experimental design, and domain prerequisites. A useful tutor must pause at the failure point, expose the missing dependency, and reconnect the explanation to the exact sentence or equation the reader was reading.

## Why ordinary paper summarizers fail

Ordinary summarizers usually:

- compress math before explaining it;
- skip notation because it looks “obvious”;
- jump between equations without naming the operation;
- blur definitions, assumptions, lemmas, and claims into prose;
- answer interruptions as isolated Q&A instead of repairing the dependency chain;
- produce a gist but not a reconstructable mental model.

PaperMentor's philosophy is different:

> **Do not summarize papers. Debug understanding.**

A user understands a paper only when they can reconstruct:

1. the problem;
2. the core intuition;
3. every major equation;
4. every derivation transition;
5. the dependency chain between definitions, lemmas, theorems, methods, and claims;
6. the one-sentence mental model.

## Core workflow

1. **Scan the paper** with `paper-scanner` to produce a paper map.
2. **Build prerequisites** with `prerequisite-analyzer` so missing background is explicit.
3. **Explain equations atomically** with `equation-analyzer`.
4. **Trace derivations** with `derivation-tracer` without skipping transitions.
5. **Trace dependencies** with `dependency-tracer` across definitions, lemmas, theorems, algorithms, equations, and claims.
6. **Walk proofs and methods** with `proof-analyzer` and `method-analyzer`.
7. **Handle interruptions** with `confusion-resolver` and recursive why.
8. **Extract the mental model** with `mental-model-extractor`.
9. **Plan visualizations only when useful** with `visualization-planner`.

## Installation

### macOS / Linux

```bash
git clone https://github.com/ShinyJay2/PaperMentor.git
cd PaperMentor
./install.sh
```

### Windows PowerShell

```powershell
git clone https://github.com/ShinyJay2/PaperMentor.git
cd PaperMentor
.\install.ps1
```

The installer copies the canonical `skills/papermentor` entrypoint plus bundled `prompts/`, `templates/`, `examples/`, and `tests/` resources into your Codex skills directory, defaulting to:

```text
~/.codex/skills/papermentor
```

Override the destination with `CODEX_HOME`:

```bash
CODEX_HOME=/path/to/.codex ./install.sh
```

## CLI examples

After installation, invoke the skill in Codex with requests like:

```text
Use $papermentor to scan this paper and create a paper map.
```

```text
Use $papermentor to explain Equation (7) atomically. Do not skip symbols.
```

```text
Use $papermentor to trace the derivation from Eq. (3) to Eq. (5), including substitutions and assumptions.
```

```text
Use $papermentor in Korean. 이 논문에서 Theorem 2가 왜 필요한지 dependency trace 해줘.
```

## Command-like UX

PaperMentor uses command-like intents rather than a separate executable:

| Intent | Use when |
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

See [`skills/papermentor/commands.md`](skills/papermentor/commands.md) for the full command contract.

## Korean support

PaperMentor supports Korean and English. If the user asks in Korean, explanations should be in Korean while preserving equations and notation in LaTeX.

Example:

```text
질문: Equation (4)의 \(\mathbb{E}_{x \sim p_{\text{data}}}\)가 무슨 뜻인지 설명해줘.
```

Response style:

```markdown
먼저 식을 그대로 보겠습니다.

\[
\mathcal{L}(\theta)=\mathbb{E}_{x \sim p_{\text{data}}}\left[-\log p_\theta(x)\right]
\]

- \(\mathcal{L}(\theta)\): 파라미터 \(\theta\)에 대한 손실 함수입니다.
- \(x \sim p_{\text{data}}\): 데이터 분포 \(p_{\text{data}}\)에서 샘플 \(x\)를 뽑는다는 뜻입니다.
- \(\mathbb{E}_{x \sim p_{\text{data}}}\): 그 샘플링 과정에 대한 평균입니다.
```

See [`examples/korean_equation_explanation.md`](examples/korean_equation_explanation.md).

## LaTeX-first examples

PaperMentor has a strict mathematical policy:

- all non-trivial math must be displayed in LaTeX;
- never use ASCII math as a replacement;
- every equation must be shown before explanation;
- every symbol, subscript, superscript, operator, domain, codomain, expectation, norm, index set, and constant must be explained.

## Atomic equation explanation example

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

## Derivation trace example

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

See [`examples/derivation_trace_example.md`](examples/derivation_trace_example.md).

## Dependency trace example

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

See [`examples/dependency_trace_example.md`](examples/dependency_trace_example.md).

## Interruptible reading example

```text
User: Pause. Why did the sign flip in the second line?
```

PaperMentor response contract:

1. pause the current location;
2. answer the question;
3. identify the missing dependency;
4. give a minimal example;
5. reconnect to the original equation or sentence;
6. resume from the exact location.

Example:

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

## Visualization example

Visualization is only a support tool for conceptual confusion. Every visualization plan must include a question, concept, visual encoding, what to observe, conclusion, and limitation.

```markdown
Question: Why does projecting high-dimensional vectors preserve pairwise distances approximately?
Concept: Random projection / Johnson-Lindenstrauss intuition.
Visual encoding: Scatter points in \(\mathbb{R}^2\), project to a random 1D line, and draw before/after pairwise distance bars.
What to observe: Nearby points tend to remain nearby, but some distortion appears.
Conclusion: Random projection trades exact geometry for controlled distortion.
Limitation: A 2D-to-1D sketch illustrates distortion qualitatively; it does not prove the high-dimensional concentration bound.
```

## Testing guide

Run structural validation:

```bash
npm test
```

The test script checks required files, skill frontmatter, prompt/template coverage, and policy keywords. Human reviewers should also use the checklists in [`tests/`](tests/):

- LaTeX quality
- atomic equation quality
- derivation trace quality
- dependency trace quality
- no-handwave quality
- Korean support
- visualization support

## Contribution guide

Contributions should strengthen understanding, not add product sprawl. Before opening a PR:

1. keep v1 focused on equations, derivations, dependencies, confusion repair, and mental models;
2. do not add blog export, reviewer simulation, or quiz generation;
3. update examples when changing behavior;
4. run `npm test`;
5. document any new prompt contract in `prompts/` and `skills/papermentor/commands.md`.

See [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Roadmap

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
