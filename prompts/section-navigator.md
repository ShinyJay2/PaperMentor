# Section Navigator Prompt

When the reader enters a section, the CLI must **not** invent a generic menu. If no model-authored menu exists yet, the helper writes a `pending-prompt.md` containing the section title, source excerpt, local equation snippets, concepts, and citations. Your job is to read that evidence and install a tailored menu for that specific section — by understanding the section, not by word-matching, scoring, or using fixed fallback labels.

Never use placeholder actions such as `Map <section>`, `Decode key equations`, `Trace derivations`, or `Connect dependencies`. Those are forbidden as user-facing section choices because they hide the fact that the menu has not adapted to the source.

## How to classify a section

Read the section/URL heading's **title and its actual content**, then decide what kind of unit it is and what a reader would most want to do here. Use a **weak position prior** only as a tiebreak: most papers run Introduction → Related Work → Method → Experiments → Conclusion, and subsections (e.g. `3.1`, `3.2`) usually share their parent section's role (`3`). Web articles may instead be thesis → example → caveat → practical takeaway. Trust the content over the position — a creatively named section ("Drifting Models for Generation", "Designing the Drifting Field") is still the method; related work can sit at the end; a paper may have two method sections or none; a URL heading may be a tutorial step, claim, warning, code/math example, or implication.

Do not pattern-match on title keywords or count tokens. Just understand the section.

## What to propose

Offer 4–8 actions that fit *this* section, then always end with `Ask anything about <section>`. Match the action — and the template it will use — to the section's role:

- **Introduction** → the promise/mechanism, the core concepts it names, what gap it claims. (templates/method_dissection.md or a concept explanation)
- **Related Work** → contrast with the specific families/citations it actually discusses; follow a citation. (templates/dependency_trace.md)
- **Method / Approach / Model** → a compact overview, each real equation it contains explained symbol-by-symbol, its propositions/assumptions, the dependency chain, a method pipeline. (templates/equation_card.md, templates/derivation_trace.md, templates/method_dissection.md, templates/dependency_trace.md)
- **Experiments / Results / Ablations** → what each result is meant to prove, the main metric, honest ablation reading. (templates/method_dissection.md)
- **Discussion / Conclusion** → the final insight, limitations and open questions. (templates/final_insight.md)
- **URL article / tutorial heading** → explain the actual claim, example, code/math, diagram, assumption, caveat, or practical takeaway in that heading. Do not force paper-only labels when the source is a blog post or tutorial.

Name equations by what they actually are (e.g. "Explain Eq. (10): attraction − repulsion", "Explain Eq. (6): the stop-gradient objective"), pulled from reading the equation, not from a fixed label table.

## How to set it

Re-run the section with your tailored list:

```bash
papermentor section --session <slug> --index <n> --choices "Action A|Action B|…|Ask anything about <section>"
```

The navigator (and TUI) will then show your menu. When the reader picks one, the existing runner writes the pending block prompt with the matching template and you append the explanation as an HTML card.
