# Design

## Source of truth
- Status: Active
- Last refreshed: 2026-06-23
- Primary product surfaces: README hero/marketing assets; PaperMentor generated reading block document at `.papermentor/sessions/<slug>/index.html`; terminal Reading Console.
- Evidence reviewed: `README.md`, `assets/papermentor-hero.svg`, `assets/social-preview.svg`, `assets/papermentor-demo.svg`, `scripts/papermentor-session.mjs`, generated Chrome screenshot `/tmp/papermentor-screens/session-arxiv-paperlike-preview.png`.

## Brand
- Personality: rigorous, scholarly, calm, expert tutor.
- Trust signals: paper-like typography, clear reading path, rendered LaTeX, append-only session blocks, visible state files.
- Avoid: loud poster layouts, unreadable decorative grids over dense text, student-project wording, toy dashboards or unnecessary app chrome.

## Product goals
- Goals: make math-heavy papers understandable through interactive paper blocks; preserve a single readable session artifact; keep CLI choices obvious.
- Non-goals: blog export, reviewer simulation, quiz generation, generic paper summarization.
- Success signals: users can read the HTML like an annotated paper, choose the next blocker from the CLI, and inspect rendered equations without terminal LaTeX fatigue.

## Personas and jobs
- Primary personas: researchers, graduate students, engineers, and paper readers who need to understand a difficult paper quickly.
- User jobs: map the paper, decode equations, trace derivations, repair confusion, and extract a final insight.
- Key contexts of use: local Codex/Claude sessions, uploaded PDFs, arXiv papers, math-heavy browser viewing.

## Information architecture
- Primary navigation: CLI Reading Path; the HTML itself has no navigation rail.
- Core screens: generated session block document, terminal Reading Console, README product page.
- Content hierarchy: quiet paper title sheet followed by appended explanation blocks in HTML; the first paper map includes the exact screenshot/crop of the actual representative method figure when present; blockers, current choices, and diagnostics stay in terminal/state JSON.

## Design principles
- Paper first: dense explanations should read like an arXiv-adjacent annotated paper, not a SaaS dashboard.
- Grid as atmosphere: keep the paper/grid field as subtle context; never let decoration compete with formulas or prose, and avoid copying the original reference layout language.
- Interruptible progress: choices should make the next user action obvious without forcing a wizard.
- Tradeoffs: visual distinctiveness is secondary to long-form readability for math and derivation blocks.

## Visual language
- Color: warm off-white paper, muted blue accents, low-contrast grid, black scholarly text.
- Typography: Satoshi first for English text and Pretendard for Korean fallback; `Anthropic Mono` or system mono for structured labels; MathJax owns equation typography.
- Spacing/layout rhythm: single-column paper block stack with readable article measure.
- Shape/radius/elevation: manuscript sheets with subtle inset rules, tiny radius, and soft paper shadow; avoid reference-like boxed corner number tabs.
- Motion: none required; stable reading environment.
- Imagery/iconography: generated paper/network assets are acceptable for README; session block document should stay text-first.

## Components
- Existing components to reuse: paper title sheet, paper block, exact paper figure screenshot/crop block, and LaTeX block only; no topbar, sidebar, product masthead, or Choose Next chrome in HTML.
- New/changed components: quiet paper title sheet with source/update metadata; manuscript-style block folio labels that avoid the earlier reference-like corner-tab treatment.
- Variants and states: done/current/pending Reading Path states; card types for map/equation/derivation/dependency/confusion/final.
- Token/component ownership: CSS variables and HTML generation live in `scripts/papermentor-session.mjs`.

## Accessibility
- Target standard: readable contrast and keyboard/browser-native scrolling.
- Keyboard/focus behavior: generated HTML remains static and inspectable; CLI uses numbered choices.
- Contrast/readability: text must remain readable over the grid; article blocks should use a subtle or absent internal grid.
- Screen-reader semantics: use headings, lists, articles, and meaningful labels.
- Reduced motion and sensory considerations: no animation by default.

## Responsive behavior
- Supported breakpoints/devices: desktop-first local browser, responsive single-column below 980px.
- Layout adaptations: paper blocks keep readable padding and a single-column flow on all screens.
- Touch/hover differences: no hover-only actions.

## Interaction states
- Loading: static generated page, no loader needed.
- Empty: show first-block guidance.
- Error: terminal command should fail loudly; generated HTML should remain stable.
- Success: appended block appears below the previous block and the CLI Reading Path advances.
- Disabled: pending path items are visually quiet.
- Offline/slow network: MathJax CDN may not render offline; raw LaTeX remains visible in source/state.

## Content voice
- Tone: exact, serious, encouraging, non-hype inside the product surface.
- Terminology: “Reading Path”, “paper block”, “equation card”, “derivation trace”, “dependency trace”, “confusion repair”, “final insight”.
- Microcopy rules: prefer direct action labels; avoid version labels and student-project phrasing.

## Implementation constraints
- Framework/styling system: dependency-free Node script emits static HTML/CSS.
- Design-token constraints: keep tokens local to `scripts/papermentor-session.mjs` unless a broader web app is introduced.
- Performance constraints: generated HTML should be lightweight; avoid one-file-per-step HTML accumulation.
- Compatibility constraints: install scripts copy `scripts/` into Codex and Claude skill directories.
- Test/screenshot expectations: run `npm test`, script syntax checks, install smoke, pack dry-run, and Chrome headless screenshot after block-document UI changes.

## Open questions
- [ ] Whether to bundle a local MathJax fallback for fully offline rendering / owner: maintainer / impact: offline paper sessions.
