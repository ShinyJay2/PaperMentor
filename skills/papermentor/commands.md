# PaperMentor Commands

These are command-like intents for Codex conversations. They are not shell commands; they define the UX contract for using the skill.

## `/papermentor scan`

Purpose: create a paper map.

Required output:

- bibliographic identity if provided;
- problem statement;
- main objects and notation;
- assumptions;
- major definitions;
- lemmas/theorems/claims;
- major equations;
- method pipeline;
- experiment logic if present;
- suggested reading order;
- likely confusion points.

## `/papermentor prerequisites`

Purpose: build a prerequisite ladder.

Required output:

- target concept;
- prerequisites sorted from basic to advanced;
- why each prerequisite is needed;
- minimal explanation;
- paper location where it is used;
- diagnostic question to verify readiness.

## `/papermentor equation`

Purpose: explain one equation atomically.

Required output:

- equation displayed first in LaTeX;
- plain-language role of the equation;
- symbol table;
- domain/codomain table;
- operator explanations;
- assumptions;
- common mistakes;
- reconstruction checkpoint.

## `/papermentor derive`

Purpose: trace a derivation.

Required output for each transition:

- previous equation;
- next equation;
- what changed;
- operation applied;
- property/theorem/definition used;
- substitution;
- cancellation;
- assumption invoked;
- why valid.

## `/papermentor dependencies`

Purpose: trace dependency structure.

Required output:

- item under analysis;
- backward dependencies;
- forward dependencies;
- missing dependency check;
- recommended explanation order.

## `/papermentor proof`

Purpose: walk a proof line by line.

Required output:

- theorem/claim statement;
- proof strategy;
- line-by-line proof table;
- dependencies used per line;
- hidden assumptions;
- minimal example when abstract;
- why the final line proves the claim.

## `/papermentor method`

Purpose: dissect a method, architecture, or algorithm.

Required output:

- input/output contract;
- variables and parameters;
- algorithm steps;
- objective or loss;
- training/inference distinction;
- dependency on equations/theorems;
- failure modes;
- method-level final insight.

## `/papermentor confusion`

Purpose: handle interruption.

Required output:

- paused location;
- direct answer;
- missing dependency;
- minimal example;
- reconnection to original equation/sentence;
- exact resume point.

## `/papermentor why`

Purpose: recursive why.

Required output:

- current confusion statement;
- first-level answer;
- root dependency probe;
- next why layer;
- stop condition when the primitive concept is reached;
- reconstruction checkpoint.

## `/papermentor final-insight`

Purpose: extract the final insight.

Required output:

- one-sentence final insight;
- problem;
- core intuition;
- object map;
- equation map;
- dependency chain;
- method/proof/experiment relation;
- what would break if assumptions fail.

## `/papermentor visualize`

Purpose: plan a conceptual visualization.

Required output:

- question;
- concept;
- visual encoding;
- what to observe;
- conclusion;
- limitation of the visualization.
