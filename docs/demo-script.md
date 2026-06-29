# PaperMentor demo script

Use this script for a README video, GitHub social clip, or marketplace submission.

## 30-second version

1. Open a terminal beside a browser.
2. Run:

   ```bash
   pm https://lilianweng.github.io/posts/2026-06-24-scaling-laws/
   ```

3. Open the generated `index.html`.
4. Show `Start Here`: thesis, variables, and prerequisites.
5. Select `Early days: ML loss predictability` in the terminal.
6. Select an action like:

   ```text
   Explain why Amari et al.'s four learning curves all fit the power-law template epsilon ~ c * D^alpha + E
   ```

7. Refresh the HTML and show the appended explanation block.
8. Close with: “PaperMentor is not a summarizer. It debugs the exact line where understanding breaks.”

## 90-second version

### Scene 1 — the pain

Show a dense equation or proof. Say:

> Summaries skip the line I am stuck on. PaperMentor slows down there.

### Scene 2 — launch

```bash
pm ./paper.pdf
```

Show that PaperMentor creates a local reading room:

```text
.papermentor/sessions/<source>/index.html
```

### Scene 3 — Start Here

Show the first HTML block:

- source thesis,
- reading path,
- prerequisite concepts,
- representative figure when available.

### Scene 4 — section choices

Pick a section. Emphasize that choices are adapted to the selected source, not a fixed checklist.

### Scene 5 — hard part microscope

Pick an equation, proof, derivation, method, or slide narration action. Show the generated block appended to the HTML.

### Scene 6 — CTA

> If this saves you one paper-reading session, star the repo and share the block that helped.

## Demo sources

Good public demos:

- Scaling-law URL: `https://lilianweng.github.io/posts/2026-06-24-scaling-laws/`
- Local sample: `demo/sample-paper.md`
- Any arXiv PDF with visible equations and method sections.
- Korean technical notes or lecture slides to demonstrate bilingual tutoring.

## Recording checklist

- Terminal width at least 100 columns.
- Browser and terminal side-by-side.
- Use a fresh session slug for clean output.
- Keep the first clip under 90 seconds.
- End with the GitHub URL and one-line install command.
