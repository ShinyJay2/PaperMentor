# PaperMentor launch playbook

Goal: earn stars by making researchers immediately understand why PaperMentor is different from summarizers.

## Positioning

One sentence:

> PaperMentor is an AI Agent Skill that turns papers, slides, and technical URLs into an HTML reading room for debugging equations, derivations, proofs, figures, and missing lecture narration.

Do not lead with “AI summarizer.” Lead with:

- reconstruct hard papers,
- line-by-line proof/derivation microscope,
- HTML-first reading room,
- paper + slide + URL support,
- Korean/English tutoring.

## Target audiences

1. ML/AI researchers reading arXiv papers.
2. Graduate students reading proofs and dense lecture notes.
3. Engineers reading technical blog posts and system papers.
4. Korean technical learners who want bilingual explanation without losing notation.
5. Codex/Claude Code users looking for useful Skills.

## Star loops

A star happens when the visitor can imagine using the tool today. Optimize every public asset for that moment.

- README first screen: one promise, one visual, one install command.
- Demo: show the exact painful transition PaperMentor explains.
- Social post: before/after screenshot, not a feature list.
- Issue template: “Drop a paper that broke PaperMentor.”
- Good first issue: add a demo for one domain.

## Launch assets to prepare

- 60–90 second screen recording.
- 3 still screenshots:
  1. Start Here block,
  2. proof/derivation microscope block,
  3. slide narration or URL mode block.
- One portable demo HTML zip.
- A pinned GitHub issue: “Share papers/slides you want PaperMentor to handle.”
- A short Korean demo post.

## Launch sequence

### Week 0 — polish

- README hero and demo script complete.
- Install works for Codex and Claude Code.
- `npm run marketplace:check` passes.
- At least three demo sources are recorded: paper, slide, URL.

### Day 1 — soft launch

Post to:

- X/Twitter ML and research tools audience,
- LinkedIn technical audience,
- Korean developer/research communities,
- relevant Discord/Slack groups where self-promo is allowed.

Message shape:

```text
I built PaperMentor because paper summaries kept skipping the exact equation/proof line I was stuck on.

Drop a paper, slide deck, or technical URL → it creates a local HTML reading room → pick the hard section → get a line-by-line reconstruction.

Demo: <video>
GitHub: <repo>
```

### Day 2–7 — proof of usefulness

- Reply to every comment with a concrete generated block.
- Turn user-submitted hard papers into public demo snippets.
- Open issues for failure cases and label them transparently.
- Ship small fixes quickly and mention them in replies.

### Week 2 — marketplace/public directory push

- Submit to Codex/Claude skill marketplaces when available.
- Submit to “awesome AI tools” lists only after a strong demo GIF exists.
- Write a blog post: “Why summarizing papers is the wrong abstraction.”

## Content ideas

- “This proof line hides 4 operations. PaperMentor expands them.”
- “I asked it in Korean; it kept the math notation intact.”
- “A lecture slide says `P = PMC < SMC`; here is the missing narration.”
- “Scaling laws article → heading map → Chinchilla section explanation.”
- “Before: screenshot of dense equation. After: reconstructed derivation block.”

## Metrics

Track weekly:

- stars,
- installs from raw installer hits if available,
- issues opened with real papers/slides,
- demo video views,
- README click-through to install,
- marketplace installs when available.

## What not to do

- Do not market it as a generic summarizer.
- Do not overpromise fully automatic correctness for every proof or figure crop.
- Do not post walls of text; show a concrete before/after block.
- Do not hide failure cases. Public hard cases are how trust compounds.
