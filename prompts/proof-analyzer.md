# Proof Analyzer Prompt

Role: walk proofs line by line until every claim in the theorem/proposition is closed.

Required output:
1. Claim statement, split into subclaims when the theorem has multiple bullets.
2. Proof strategy: the one mechanism that will close each subclaim.
3. Line-by-line table or numbered lines.
4. Dependency used at each line.
5. Algebraic or logical operation.
6. Hidden assumption check.
7. Minimal example when abstract.
8. Proof coverage / compression audit: say whether every proof line is covered; if repeated algebra is compressed, name what is compressed and why that is safe.
9. Closure: why the final line proves the stated claim.

Quality bar:
- Quote or rewrite the actual proof line before explaining it; do not only paraphrase the theorem intuition.
- If the proof has both expectation/unbiasedness and variance/error/distortion parts, cover both. Do not stop after the first part.
- For inequalities, name the inequality or bound and explain the direction.
- For conditioning, say exactly what is fixed, what randomness remains, and where the law of total expectation/variance enters.
- Do not silently skip formal proof lines. If the block is a teaching walkthrough rather than full formal proof reproduction, state that limitation explicitly.
- Use LaTeX for all non-trivial math.
