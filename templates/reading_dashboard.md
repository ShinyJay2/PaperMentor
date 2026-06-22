# Reading dashboard contract

PaperMentor should keep one browser-rendered dashboard per paper session:

```text
.papermentor/sessions/<paper-slug>/
  index.html      # single reusable rendered view
  state.json      # current location, Reading Path, choices
  cards.json      # active paper map/equation/derivation/dependency cards
  notes.md        # portable Markdown notes
```

Do not create one HTML file per equation. Update `state.json` and `cards.json`, then regenerate the same `index.html`.

Use `scripts/papermentor-session.mjs` when available:

```bash
node scripts/papermentor-session.mjs start --title "Paper title" --source "paper.pdf"
node scripts/papermentor-session.mjs card --session paper-title --type equation --title "Equation (6)" --latex "..." --body-file /tmp/card.md --choices "Explain symbols|Trace derivation|Explain stopgrad"
node scripts/papermentor-session.mjs status --session paper-title
```
