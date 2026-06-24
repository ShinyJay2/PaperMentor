# Golden Quality Contracts

These examples are compact golden fixtures for automated validation. They are not tied to one paper; each contract names the required structure for a production PaperMentor block.

## Golden equation card

### Equation

\[
\mathcal{R}(f)=\mathbb{E}_{(x,y)\sim\mathcal{D}}\left[\ell(f(x),y)\right]
\]

### Role

This equation defines the population risk that the method wants to minimize.

### Symbol table

| Symbol | Meaning | Domain / codomain | Notes |
| --- | --- | --- | --- |
| $f$ | predictor being evaluated | inputs $x$ to predictions | object optimized later |
| $(x,y)$ | input-label pair | sampled from $\mathcal{D}$ | random variable pair |
| $\ell$ | loss function | prediction and target to real number | lower is better |

### Reconstruction checkpoint

The reader can say: risk is the expected loss of predictor $f$ over the data distribution.

## Golden derivation trace

### Previous equation

\[
\|a-b\|_2^2=(a-b)^\top(a-b)
\]

### Next equation

\[
\|a-b\|_2^2=a^\top a-2a^\top b+b^\top b
\]

- **What changed:** the quadratic product was expanded.
- **Operation applied:** distribute the transpose product across both terms.
- **Property / theorem / definition used:** bilinearity of the real inner product and symmetry $a^\top b=b^\top a$.
- **Substitution:** none.
- **Cancellation:** no term cancels; two cross terms combine.
- **Assumption invoked:** $a,b\in\mathbb{R}^d$.
- **Why valid:** real scalar inner products are symmetric.

## Golden dependency trace

### Backward dependencies

- Definition of the predictor $f$.
- Definition of the data distribution $\mathcal{D}$.
- Definition of the loss $\ell$.

### Forward dependencies

- Empirical risk estimator.
- Generalization claim.
- Optimization objective.

### Missing dependency check

The reader must know the difference between population expectation and finite-sample average.

### Recommended explanation order

1. Distribution $\mathcal{D}$.
2. Loss $\ell$.
3. Population risk.
4. Empirical estimator.
5. Optimization.

## Golden confusion repair

User question: `Why is the expectation outside the loss?`

Paused location: `Population risk definition`.

### Direct answer

The loss is first computed for one sampled pair $(x,y)$; the expectation then averages that random loss over all possible data pairs.

### Missing dependency

The user is missing the distinction between a random variable and its expected value.

### Minimal example

If two samples have losses $1$ and $3$ with equal probability, the expected loss is $2$.

### Reconnection to original text

In $\mathcal{R}(f)$, $\ell(f(x),y)$ is the per-sample loss and $\mathbb{E}_{(x,y)\sim\mathcal{D}}$ turns it into the paper's population-level objective.

### Resume point

Return to the next equation and check whether it replaces the expectation with a finite average.

## Golden Korean explanation

사용자가 한국어로 질문하면 설명은 자연스러운 한국어여야 하며, 수식과 notation은 유지한다.

\[
\mathbb{E}_{(x,y)\sim\mathcal{D}}[\ell(f(x),y)]
\]

- $\mathbb{E}$는 가능한 sample들에 대한 평균이다.
- `loss`, `objective function`, `gradient`, `distribution` 같은 연구 맥락의 표준 용어는 어색하게 직역하지 않는다.
- 마지막에는 원래 논문 위치로 다시 연결한다.
