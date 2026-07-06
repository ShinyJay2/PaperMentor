# PaperMentor Marketplace Checklist

This checklist is for Codex / Claude marketplace submission readiness. It is not a user tutorial; it records the public promise, required artifacts, verification commands, and known limits before publishing.

## User promise

PaperMentor is an interactive paper and slide understanding skill. It opens an HTML reading room, then uses a small arrow-key TUI to choose sections, slide topics, equations, proofs, methods, dependencies, and questions. It is not a paper summarizer; it should teach the hard part until the reader can reconstruct the source.

## Submission checklist

- [ ] `README.md` explains install, first run, source modes, examples, and product boundaries.
- [ ] `SKILL.md` and `skills/papermentor/SKILL.md` have marketplace-safe frontmatter and no private instructions.
- [ ] `papermentor.manifest.json` and `package.json.files` are in sync.
- [ ] Package excludes `.papermentor/`, `.omx/`, local screenshots, PDFs, PPT/PPTX, and private state.
- [ ] Local assets are bundled: Satoshi, Pretendard, MathJax, demo SVGs.
- [ ] Skill commands expose simple user entrypoints: `$papermentor <file-or-url>` in Codex and `/papermentor <file-or-url>` in Claude; local bridge commands use `papermentor open/go/ask/qa/export`.
- [ ] TUI remains readable at narrow terminal widths and uses only arrow keys + Enter for normal navigation.
- [ ] Launch generation is bundled: Start Here plus first section choices are generated together; no hidden generic fallback menu.
- [ ] Prompt budget evaluator passes for launch bundle and prefetched HTML block.

## Verification commands

Run before marketplace submission:

```bash
npm run marketplace:check
```

That command runs:

```bash
npm run manifest:check
npm run perf:prompts
npm test
npm run pack:check
```

It also performs narrow-width welcome/TUI snapshot checks and a mock launch smoke test.

## Known limits

- Live provider latency depends on Codex/Claude service variance; PaperMentor mitigates it with prompt budgets, launch bundling, generated-block cache, and background prefetch.
- Representative figure selection/cropping can still require user or agent inspection for unusual PDFs.
- Very long, scanned, or protected PDFs may need OCR or an accessible text layer.
- Marketplace review should include live QA on several papers and slide decks before public promotion.
