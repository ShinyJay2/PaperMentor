# Proof Walkthrough

## Claim statement

Split multiple theorem bullets into subclaims.

## Proof strategy

Name the mechanism that closes each subclaim.

## Notation and objects

Define every symbol, random variable, conditioning event, index, distribution, denominator, indicator, map, and fixed quantity that appears in the proof.

## Line transition microscope

For each adjacent pair of proof lines, show:

### Transition N → N+1

Previous line:

\[
% previous proof line
\]

Next line:

\[
% next proof line
\]

What changed:

- primitive micro-steps, if the displayed transition compresses more than one operation:
- operation inferred from the displayed math:
- term-by-term movement:
- local symbol changes:
- expression recognized or reinterpreted, if present:
- what is held fixed vs averaged over:
- hidden condition needed for the move:
- why this move advances the claim:

Do not skip from one displayed proof line to the next with only prose such as "therefore" or "by definition"; the point is to infer and explain whatever operation the selected proof actually uses. If several operations are compressed into one displayed transition, insert reconstructed intermediate lines and keep splitting until each micro-step is one primitive local transformation.

## Expectation / conditioning audit

If the proof uses expectations, conditioning, variance, or randomness, state what is fixed and what remains random.

## Operation audit

List the exact term movements and expression reinterpretations that drive the proof. Name operations from the selected proof itself, not from a predefined menu.

## Inequality / bound audit

Name every inequality or bound and explain its direction.

## Proof coverage / compression audit

State whether this block covers every proof line or intentionally compresses repeated algebra. If anything is omitted, name exactly what is omitted and why it is safe for teaching.

## Minimal example

Use a small numeric or symbolic example if the proof object is abstract.

## Closure

Explain why the final line proves every part of the claim.

## Reconstruction checkpoint


## Term purpose audit

For every non-trivial term in the proof lines, explain what role it plays in the proof or claim: what it controls, cancels, bounds, averages, conditions on, weights, or carries forward.
