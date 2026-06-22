# Interactive console template

```text
╭─ PaperMentor Reading Console ─────────────────────────────────────────────╮
│ Paper: {{paper_title}}                                                    │
│ Location: {{current_location}}                                            │
│ Focus: {{current_focus}}                                                  │
│ View: {{session_path}}/index.html                                         │
╰──────────────────────────────────────────────────────────────────────────╯

Reading Path
  [{{map_status}}] Map the paper
  [{{equations_status}}] Decode key equations
  [{{derivations_status}}] Trace derivations
  [{{dependencies_status}}] Connect dependencies
  [{{confusion_status}}] Resolve confusion
  [{{final_status}}] Extract final insight

Choose next:
  [1] {{choice_1}}
  [2] {{choice_2}}
  [3] {{choice_3}}
  [4] {{choice_4}}
```

Status marks:

- `[✓]` complete
- `[›]` recommended current step
- `[ ]` pending
- `[!]` blocked by unresolved confusion
- `[↺]` revisit recommended
