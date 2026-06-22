# Contributing to PaperMentor

PaperMentor is a focused Codex Skill for research-paper understanding. Contributions should make the tutor better at debugging understanding, not broader at generating content.

## Product boundaries

Current product scope:

- paper maps;
- prerequisite ladders;
- atomic equation explanations;
- derivation traces;
- dependency traces;
- proof walkthroughs;
- method dissection;
- confusion repair;
- recursive why;
- Korean/English support;
- mental model extraction;
- conceptual visualization planning.

Deliberately out of scope:

- blog export;
- reviewer simulation;
- quiz generation.

## Development workflow

1. Create a focused branch.
2. Update the relevant prompt, template, example, and checklist together.
3. Run `npm test`.
4. Manually inspect generated examples for handwaving.
5. Open a PR explaining what understanding failure mode your change improves.

## Quality expectations

- Every non-trivial equation must be rendered in LaTeX before explanation.
- Every derivation transition must identify the operation, property, substitution, cancellation, assumption, and validity reason.
- Dependency traces must include backward dependencies, forward dependencies, missing dependency check, and recommended explanation order.
- Korean examples must preserve mathematical notation exactly.

## Commit messages

Use concise, decision-oriented commit messages. Explain why the change improves paper understanding.
