# Interactive session example

User:

```text
Use $papermentor on https://arxiv.org/pdf/2602.04770
```

PaperMentor should create one local dashboard and print a Reading Console:

```text
╭─ PaperMentor Reading Console ─────────────────────────────────────────────╮
│ Paper: Generative Modeling via Drifting                                   │
│ Location: Paper map                                                       │
│ Focus: Start with the paper map, then choose the next blocker.            │
│ View: .papermentor/sessions/generative-modeling-via-drifting/index.html  │
╰──────────────────────────────────────────────────────────────────────────╯

Reading Path
  [›] Map the paper
  [ ] Decode key equations
  [ ] Trace derivations
  [ ] Connect dependencies
  [ ] Resolve confusion
  [ ] Extract final insight

Choose next:
  [1] Decode Training objective — Eq. (6) symbol by symbol
  [2] Trace Drift update — Eq. (4) → Training objective — Eq. (6)
  [3] Explain why stopgrad is used
  [4] Explain what V_{p,q} means visually
  [5] I’m confused — ask me diagnostic questions
```

After the user chooses a number, PaperMentor adds a card to `cards.json`, regenerates the same `index.html`, and prints the next Reading Console. It should not create separate HTML files for each equation.
