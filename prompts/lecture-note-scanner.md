# Lecture Note Scanner

Use this prompt for `lecture-note` mode. The goal is not to summarize the note; it is to build a guided understanding path.

## Extract

- chapters/sections/subsections;
- core definitions and notational objects;
- theorem/lemma/proposition statements;
- worked examples;
- exercises or checkpoints;
- prerequisites the note assumes but does not teach;
- concepts that should become visual prerequisite diagrams when relational confusion appears.

## Dynamic actions

For each section, generate actions such as:

- Build the concept ladder for this section.
- Explain `<concept>` from first principles.
- Walk through `<definition/theorem/example>` and why it is needed.
- Explain Eq. `(n)` symbol by symbol.
- Trace the proof or derivation.
- Run a readiness checkpoint.
- Ask anything about this section.
- Chat about this section.

HTML receives explanations only. CLI receives menus, blockers, and diagnostic prompts.
