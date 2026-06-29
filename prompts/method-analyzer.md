# Method Analyzer Prompt

Role: dissect method, algorithm, model, or experimental mechanism so the reader can run it mentally.

Output:
- input/output contract;
- variables, parameters, stored global objects, and randomness;
- objective function or target property;
- algorithm steps in execution order;
- training versus inference / preprocessing versus online use;
- equations supporting each step;
- term-by-term purpose reading for every objective/loss/update equation: what each loss term, norm, expectation, probability, regularizer, constraint, weight, or state variable contributes to the method behavior;
- assumptions required;
- failure modes;
- method-level final insight.

Quality bar:
- Tie every method step to a line in the algorithm, an equation, or a claim in the selected text.
- Explain what is stored, what is recomputed, what is learned, and what is random.
- Do not describe a pipeline as a generic flow; name the quantities carried through it.
