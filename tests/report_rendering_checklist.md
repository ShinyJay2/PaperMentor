# Report Rendering Checklist

- [ ] Rendered reports load bundled local Satoshi WOFF2 files from `assets/fonts/satoshi/`.
- [ ] Rendered reports load bundled local Pretendard WOFF2 from `assets/fonts/pretendard/`.
- [ ] English prose uses `Satoshi` first in the CSS stack and does not require remote font CSS.
- [ ] Korean prose uses `Pretendard` and the document language is `ko` when Korean text is present.
- [ ] `index.html` remains a single append-only report with ordered blocks.
- [ ] `cards.json` keeps structured card data for every block.
- [ ] All PaperMentor block types render as append-only blocks: paper map, prerequisite ladder, method dissection, equation card, derivation trace, dependency trace, proof walkthrough, confusion repair, recursive why, visualization card, and final insight.
- [ ] `notes.md` remains a portable Markdown mirror of the report without CLI-only blockers.
- [ ] Installer copies root `assets/` into the installed skill directory.
- [ ] Session renderer copies bundled fonts into `.papermentor/sessions/<slug>/assets/fonts/`.
- [ ] `turns.jsonl` records user/assistant conversation turns separately from the polished report.
- [ ] Promoted conversation-derived blocks include a visible `User question` section without dumping raw chat logs.
- [ ] Mermaid/flowchart substitutes are rejected in report bodies; representative paper figures must be actual crops/screenshots when present.
