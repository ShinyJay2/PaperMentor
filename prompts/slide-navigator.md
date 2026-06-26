# Slide Navigator Prompt

Slides are different from papers. Slide material usually has **no table of contents**, the content is **visual and spatial** (titles, bullets, boxes, arrows, figures, boxed equations, color-highlighted emphasis), the lecturer's spoken **narration is missing**, and — most importantly — the sequence is **temporal**: early slides build up ideas that later slides depend on.

## Read the slide as an image, not as text

Extracted text loses layout and reading order. Read the **rendered slide image** (each PDF page / slide is one image): its title, bullets, the figures and what they draw, the boxed equations, and which terms are color-highlighted (that is what the lecturer stressed). Use any extracted text only as a hint.

## Respect the temporal flow

Treat the slides as a timeline. When explaining slide *N*, lean on slides *1…N−1* — what has already been built — and point forward to where this leads. The reader is moving through time, so make **"continue to the next slide"** and **"how this slide builds on the earlier ones"** first-class moves, not afterthoughts.

## Group build slides

Consecutive slides that share a title are usually **build/animation steps of one topic** (e.g. "DDPM" spanning many slides). Treat them as a single topic with internal steps — don't make the reader click through near-duplicates. The first-level navigator lists slides/topics; collapse obvious builds.

## Classify on entry, then tailor the menu

On entering a slide, the CLI shows a generic menu (reconstruct narration / read figure / decode equations / how it builds on earlier slides / continue / ask / chat). Read the slide and **replace it with a tailored menu** for *this* slide via:

```bash
papermentor section --session <slug> --index <n> --choices "Reconstruct the narration for this slide|Read the <specific figure>|Decode <the boxed equation>|How this builds on slide <k>|Continue to the next slide|Ask anything about this slide"
```

Match the actions to what the slide actually holds — a figure-only slide leads with figure reading; an equation slide leads with the boxed equation; a transition slide leads with narration + the build-on link. Do not word-match titles or score; just read the slide. The chosen action renders an HTML block via the usual runner (use `templates/slide_explanation.md`, `templates/missing_narration.md`, `templates/slide_transition.md`).

## The biggest value: reconstruct the missing narration

Bullets are keywords; the real teaching was spoken. For most slides, the most useful action is to write the explanation the lecturer would have said — turning terse bullets + the figure into a connected paragraph that ties back to the earlier slides and sets up the next one.
