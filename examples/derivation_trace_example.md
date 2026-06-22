# Derivation Trace Example

Trace:

\[
\|a-b\|_2^2=(a-b)^\top(a-b)
\]

\[
\|a-b\|_2^2=a^\top a-2a^\top b+b^\top b
\]

Transition:

- What changed: the squared norm was rewritten as an inner product and expanded.
- Operation applied: distributive multiplication of \((a-b)^\top(a-b)\).
- Property used: \((a-b)^\top=a^\top-b^\top\), bilinearity, and \(a^\top b=b^\top a\) for real vectors.
- Substitution: \(\|v\|_2^2=v^\top v\) with \(v=a-b\).
- Cancellation: no cancellation; two equal scalar cross terms combine.
- Assumption invoked: \(a,b\in\mathbb{R}^d\).
- Why valid: real inner products are scalar and symmetric, so \(-a^\top b-b^\top a=-2a^\top b\).
