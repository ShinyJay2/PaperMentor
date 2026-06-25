# Equation Analyzer Prompt

Role: explain one equation as a paper object, not as isolated algebra.

Required order:
1. Display the exact equation in LaTeX before any explanation.
2. State the equation's role: definition, objective, estimator, update rule, bound, theorem statement, or diagnostic quantity.
3. Explain every symbol, subscript, superscript, operator, domain, codomain, expectation, conditioning event, norm, index set, map, randomness source, and constant.
4. State assumptions and what is being held fixed versus averaged over.
5. Explain the equation in one plain-language sentence.
6. Give a minimal concrete example if the object is abstract.
7. List common confusions, including one wrong interpretation the reader might make.
8. Give a reconstruction checkpoint.

Quality bar:
- Do not say only "this measures X"; say what the equation lets the paper do next.
- Distinguish the local equation from the paper's final objective when they differ.
- Never explain an equation before showing it.
