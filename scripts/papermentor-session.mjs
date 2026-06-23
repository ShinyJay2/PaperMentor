#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, copyFileSync, cpSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.cwd();
const scriptDir = dirname(fileURLToPath(import.meta.url));
const skillRoot = dirname(scriptDir);
const bundledAssetsDir = join(skillRoot, 'assets');
const baseDir = join(root, '.papermentor', 'sessions');
const pathItems = [
  ['map', 'Map the paper'],
  ['equations', 'Decode key equations'],
  ['derivations', 'Trace derivations'],
  ['dependencies', 'Connect dependencies'],
  ['confusion', 'Resolve confusion'],
  ['final', 'Extract final insight']
];

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) args._.push(token);
    else {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) args[key] = true;
      else { args[key] = next; i += 1; }
    }
  }
  return args;
}

function slugify(value) {
  return String(value || 'paper-session')
    .toLowerCase()
    .replace(/https?:\/\//g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'paper-session';
}

function now() { return new Date().toISOString(); }

function sessionDir(slug) { return join(baseDir, slug); }
function statePath(slug) { return join(sessionDir(slug), 'state.json'); }
function cardsPath(slug) { return join(sessionDir(slug), 'cards.json'); }
function notesPath(slug) { return join(sessionDir(slug), 'notes.md'); }
function turnsPath(slug) { return join(sessionDir(slug), 'turns.jsonl'); }
function indexPath(slug) { return join(sessionDir(slug), 'index.html'); }
function assetDir(slug) { return join(sessionDir(slug), 'assets'); }

function readJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, data) {
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}

function defaultState({ title, source, slug }) {
  return {
    schema: 'papermentor.session.v1',
    title,
    source,
    slug,
    createdAt: now(),
    updatedAt: now(),
    currentLocation: 'Paper map',
    currentFocus: 'Start with the paper map, then choose the next blocker.',
    readingPath: pathItems.map(([key, label], index) => ({ key, label, status: index === 0 ? 'current' : 'pending' })),
    nextChoices: [
      'Decode key equations',
      'Trace the first important derivation',
      'Build a dependency chain',
      'Ask me what feels confusing'
    ],
    renderedView: `.papermentor/sessions/${slug}/index.html`
  };
}

function ensureSession({ title, source, slug }) {
  const dir = sessionDir(slug);
  mkdirSync(dir, { recursive: true });
  const state = existsSync(statePath(slug))
    ? readJson(statePath(slug), {})
    : defaultState({ title, source, slug });
  state.updatedAt = now();
  state.title = title || state.title;
  state.source = source || state.source;
  state.renderedView = `.papermentor/sessions/${slug}/index.html`;
  const cards = readJson(cardsPath(slug), { schema: 'papermentor.cards.v1', cards: [] });
  writeJson(statePath(slug), state);
  writeJson(cardsPath(slug), cards);
  if (!existsSync(notesPath(slug))) {
    writeFileSync(notesPath(slug), `# PaperMentor session: ${state.title}\n\nSource: ${state.source || 'not provided'}\n\n`);
  }
  if (!existsSync(turnsPath(slug))) {
    writeFileSync(turnsPath(slug), '');
  }
  renderHtml(slug);
  return { state, cards };
}

function setPathStatus(state, key, status) {
  state.readingPath = state.readingPath.map((item) => {
    if (item.key === key) return { ...item, status };
    if (status === 'current' && item.status === 'current') return { ...item, status: 'done' };
    return item;
  });
}

function inferPathKey(type) {
  const map = {
    'paper-map': 'map', scan: 'map', prerequisite: 'map', prerequisites: 'map', 'prerequisite-ladder': 'map', method: 'map',
    equation: 'equations', 'equation-card': 'equations', derivation: 'derivations', 'derivation-trace': 'derivations',
    dependency: 'dependencies', dependencies: 'dependencies', proof: 'dependencies', 'proof-walkthrough': 'dependencies',
    confusion: 'confusion', why: 'confusion', 'recursive-why': 'confusion', visualization: 'confusion', visualize: 'confusion',
    final: 'final', 'final-insight': 'final'
  };
  return map[type] || null;
}

function readBody(args) {
  if (args['body-file']) return readFileSync(resolve(args['body-file']), 'utf8');
  if (args.body) return args.body;
  return '';
}

function readTextArg(args) {
  if (args['text-file']) return readFileSync(resolve(args['text-file']), 'utf8');
  if (args.text) return String(args.text);
  if (args.body) return String(args.body);
  if (args['body-file']) return readFileSync(resolve(args['body-file']), 'utf8');
  return '';
}

function turnId(index) {
  return `turn-${String(index).padStart(3, '0')}`;
}

function readTurns(slug) {
  if (!existsSync(turnsPath(slug))) return [];
  return readFileSync(turnsPath(slug), 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function appendTurn(args) {
  const slug = args.session || args.slug;
  if (!slug) throw new Error('turn requires --session <slug>');
  const state = readJson(statePath(slug), null);
  if (!state) throw new Error(`session not found: ${slug}`);
  const turns = readTurns(slug);
  const promotion = args.promote ? 'promote' : args['no-promote'] ? 'log-only' : (args.promotion || 'auto');
  const turn = {
    id: args.id || turnId(turns.length + 1),
    role: args.role || 'user',
    text: readTextArg(args),
    location: args.location || state.currentLocation,
    promotion,
    reason: args.reason || '',
    savedAs: args['saved-as'] || args.savedAs || '',
    createdAt: now()
  };
  appendFileSync(turnsPath(slug), `${JSON.stringify(turn)}\n`);
  state.updatedAt = now();
  writeJson(statePath(slug), state);
  console.log(`Logged ${turn.id} (${turn.role}, ${turn.promotion}) to .papermentor/sessions/${slug}/turns.jsonl`);
}

function hasForbiddenDiagramSubstitute(markdown) {
  return /```\s*mermaid\b/i.test(markdown)
    || /^\s*(graph|flowchart)\s+(TD|TB|BT|RL|LR)\b/im.test(markdown)
    || /<div[^>]+class=["'][^"']*mermaid/i.test(markdown);
}

function splitChoices(value) {
  if (!value) return [];
  return String(value).split('|').map((x) => x.trim()).filter(Boolean);
}


function isUrl(value) {
  return /^https?:\/\//i.test(String(value || '')) || /^data:/i.test(String(value || ''));
}

function isProvenanceOnlyCaption(value) {
  const caption = String(value || '').trim().toLowerCase();
  if (!caption) return false;
  return /^(exact|actual)?\s*(crop|screenshot|capture|extraction)\s+(of|from)\b/.test(caption)
    || /^exact\s+crop\b/.test(caption)
    || /^captured\s+from\b/.test(caption)
    || /^extracted\s+from\b/.test(caption)
    || /^main\s+method\s+figure\s+from\s+the\s+paper\.?$/.test(caption)
    || /^figure\s+from\s+the\s+paper\.?$/.test(caption);
}

function figureCaption(args) {
  const caption = args['figure-caption'] || args.caption || '';
  return isProvenanceOnlyCaption(caption) ? '' : caption;
}

function copyBundledReportAssets(slug) {
  const sourceFonts = join(bundledAssetsDir, 'fonts');
  if (!existsSync(sourceFonts)) return;
  mkdirSync(assetDir(slug), { recursive: true });
  cpSync(sourceFonts, join(assetDir(slug), 'fonts'), { recursive: true });
}

function prepareFigure(slug, cardId, args) {
  const source = args['figure-file'] || args.figure || args['figure-url'] || args['image-file'] || args.image;
  if (!source) return null;

  let src = String(source);
  if (!isUrl(src)) {
    const absoluteSource = resolve(src);
    if (!existsSync(absoluteSource)) throw new Error(`figure file not found: ${src}`);
    mkdirSync(assetDir(slug), { recursive: true });
    const extension = extname(absoluteSource) || '.png';
    const safeBase = slugify(`${cardId}-${basename(absoluteSource, extension)}`) || slugify(cardId);
    const fileName = `${safeBase}${extension.toLowerCase()}`;
    copyFileSync(absoluteSource, join(assetDir(slug), fileName));
    src = `assets/${fileName}`;
  }

  return {
    src,
    alt: args['figure-alt'] || args.alt || `${args.title || 'Paper'} figure`,
    caption: figureCaption(args)
  };
}

function addCard(args) {
  const slug = args.session || args.slug;
  if (!slug) throw new Error('card requires --session <slug>');
  const state = readJson(statePath(slug), null);
  if (!state) throw new Error(`session not found: ${slug}`);
  const cards = readJson(cardsPath(slug), { schema: 'papermentor.cards.v1', cards: [] });
  const type = args.type || 'note';
  const body = readBody(args);
  if (hasForbiddenDiagramSubstitute(body)) {
    throw new Error('report body contains a Mermaid/flowchart diagram substitute; attach an actual paper figure crop or write prose instead');
  }
  const cardId = args.id || `${type}-${String(cards.cards.length + 1).padStart(3, '0')}`;
  const card = {
    id: cardId,
    type,
    title: args.title || type,
    location: args.location || state.currentLocation,
    latex: args.latex || '',
    figure: prepareFigure(slug, cardId, args),
    userQuestion: args['user-question'] || args.question || '',
    promotionReason: args['promotion-reason'] || args.reason || '',
    originTurn: args['origin-turn'] || args.originTurn || '',
    body,
    choices: splitChoices(args.choices),
    createdAt: now()
  };
  cards.cards.push(card);
  const pathKey = inferPathKey(type);
  if (pathKey) setPathStatus(state, pathKey, args.status || 'done');
  const nextKey = args.next || pathItems.find(([key]) => state.readingPath.find((item) => item.key === key)?.status === 'pending')?.[0];
  if (nextKey) setPathStatus(state, nextKey, 'current');
  state.currentLocation = card.location;
  state.currentFocus = card.title;
  state.nextChoices = card.choices.length ? card.choices : state.nextChoices;
  state.updatedAt = now();
  writeJson(cardsPath(slug), cards);
  writeJson(statePath(slug), state);
  const noteFigureExplanation = figureExplanationMarkdown(card);
  const noteBody = card.figure ? bodyWithoutFigureExplanation(card.body || '') : (card.body || '');
  appendFileSync(notesPath(slug), `
## ${card.title}

Location: ${card.location}

${card.userQuestion ? `### User question\n\n${card.userQuestion}\n\n` : ''}${card.latex ? `$$
${card.latex}
$$

` : ''}${card.figure ? `![${card.figure.alt}](${card.figure.src})

${noteFigureExplanation ? `${noteFigureExplanation}

` : ''}` : ''}${noteBody}
`);
  renderHtml(slug);
  printConsole(state, cards);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function containsKorean(value) {
  return /[\u3131-\u318e\uac00-\ud7a3]/.test(String(value || ''));
}

function documentLanguage(state, cards) {
  const text = [
    state?.title,
    state?.source,
    ...(cards?.cards || []).flatMap((card) => [card.title, card.location, card.userQuestion, card.body, card.figure?.caption])
  ].join('\n');
  return containsKorean(text) ? 'ko' : 'en';
}

function statusIcon(status) {
  return { done: '✓', current: '›', pending: ' ', blocked: '!', review: '↺' }[status] || ' ';
}

function statusClass(status) {
  return { done: 'done', current: 'current', pending: 'pending', blocked: 'blocked', review: 'review' }[status] || 'pending';
}

function renderHtml(slug) {
  copyBundledReportAssets(slug);
  const state = readJson(statePath(slug), {});
  const cards = readJson(cardsPath(slug), { cards: [] });
  const lang = documentLanguage(state, cards);
  const html = `<!doctype html>
<html lang="${escapeHtml(lang)}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>PaperMentor · ${escapeHtml(state.title)}</title>
<script>
window.MathJax = { tex: { inlineMath: [['$', '$'], ['\\\\(', '\\\\)']], displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']] }, svg: { fontCache: 'global' } };
</script>
<script defer src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js"></script>
<style>
@font-face { font-family:"Satoshi"; src:url("assets/fonts/satoshi/Satoshi-300.woff2") format("woff2"); font-weight:300; font-style:normal; font-display:swap; }
@font-face { font-family:"Satoshi"; src:url("assets/fonts/satoshi/Satoshi-400.woff2") format("woff2"); font-weight:400; font-style:normal; font-display:swap; }
@font-face { font-family:"Satoshi"; src:url("assets/fonts/satoshi/Satoshi-500.woff2") format("woff2"); font-weight:500; font-style:normal; font-display:swap; }
@font-face { font-family:"Satoshi"; src:url("assets/fonts/satoshi/Satoshi-700.woff2") format("woff2"); font-weight:700; font-style:normal; font-display:swap; }
@font-face { font-family:"Satoshi"; src:url("assets/fonts/satoshi/Satoshi-900.woff2") format("woff2"); font-weight:900; font-style:normal; font-display:swap; }
@font-face { font-family:"Pretendard"; src:url("assets/fonts/pretendard/PretendardVariable.woff2") format("woff2-variations"); font-weight:45 920; font-style:normal; font-display:swap; }
:root {
  color-scheme: light;
  --field:#f3efe4;
  --paper:#fffef9;
  --ink:#191715;
  --muted:#726b60;
  --line:#d6ccba;
  --rule:#2a2723;
  --accent:#405f9f;
  --accent-soft:#eef2f8;
  --mono: "Anthropic Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  --text: "Satoshi", "Pretendard", "Apple SD Gothic Neo", Inter, "Helvetica Neue", Arial, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
}
* { box-sizing:border-box; }
html { scroll-behavior:smooth; }
body {
  margin:0;
  color:var(--ink);
  font-family:var(--text);
  background:
    linear-gradient(90deg, rgba(79,60,32,.035) 1px, transparent 1px),
    linear-gradient(180deg, rgba(79,60,32,.035) 1px, transparent 1px),
    radial-gradient(circle at 50% -10%, rgba(255,255,255,.7), transparent 34%),
    var(--field);
  background-size:28px 28px, 28px 28px, auto, auto;
}
.page {
  width:min(900px, calc(100% - 44px));
  margin:0 auto;
  padding:42px 0 84px;
}
.paper-title {
  max-width:820px;
  margin:0 auto 34px;
  padding:22px 24px 24px;
  text-align:center;
  background:rgba(255,254,249,.72);
  border-top:3px double var(--rule);
  border-bottom:1px solid var(--line);
}
.paper-title h1 {
  margin:0;
  color:var(--ink);
  font-family:var(--text);
  font-size:clamp(31px, 4.7vw, 50px);
  line-height:1.04;
  font-weight:760;
  letter-spacing:-.045em;
}
.paper-source,
.paper-meta {
  margin-top:10px;
  color:var(--muted);
  font-family:var(--mono);
  font-size:10px;
  letter-spacing:.04em;
  text-transform:uppercase;
  overflow-wrap:anywhere;
}
.paper-meta { margin-top:7px; }
.blocks { display:grid; gap:30px; }
.block {
  position:relative;
  background:var(--paper);
  border:1px solid var(--line);
  border-radius:2px;
  padding:40px 56px 50px;
  box-shadow:0 16px 38px rgba(65,48,26,.075);
}
.block:after {
  content:'';
  position:absolute;
  inset:10px;
  border:1px solid rgba(214,204,186,.42);
  pointer-events:none;
}
.block-head {
  position:relative;
  z-index:1;
  display:grid;
  grid-template-columns:1fr auto;
  gap:18px;
  align-items:start;
  border-bottom:1px solid var(--rule);
  padding-bottom:13px;
  margin-bottom:23px;
}
.block h1,
.block h2,
.block h3 {
  color:var(--ink);
  font-family:var(--text);
  font-weight:740;
  line-height:1.12;
  letter-spacing:-.035em;
}
.block-title {
  margin:0;
  font-size:31px;
}
.folio {
  align-self:start;
  border:1px solid var(--line);
  background:var(--accent-soft);
  color:var(--accent);
  padding:5px 8px;
  font-family:var(--mono);
  font-size:10px;
  font-weight:700;
  letter-spacing:.06em;
  text-transform:uppercase;
  white-space:nowrap;
}
.location {
  margin-top:7px;
  color:var(--muted);
  font-family:var(--mono);
  font-size:10px;
  letter-spacing:.04em;
  text-transform:uppercase;
}

.paper-figure {
  position:relative;
  z-index:1;
  margin:18px auto 26px;
  max-width:760px;
  border:1px solid #d8cebd;
  background:#fbf7ef;
  padding:12px;
}
.paper-figure img {
  display:block;
  width:100%;
  height:auto;
  object-fit:contain;
}
.paper-figure figcaption {
  margin-top:10px;
  color:#3e3830;
  font-size:13.5px;
  line-height:1.55;
}
.paper-figure figcaption p { margin:6px 0; }
.paper-figure figcaption strong { color:var(--ink); font-weight:720; }

.user-question {
  position:relative;
  z-index:1;
  max-width:760px;
  margin:0 auto 22px;
  padding:14px 16px;
  border-left:3px solid var(--accent);
  background:#f4f0e8;
}
.user-question-label {
  margin-bottom:5px;
  color:var(--accent);
  font-family:var(--mono);
  font-size:10px;
  font-weight:700;
  letter-spacing:.06em;
  text-transform:uppercase;
}
.user-question-text {
  color:#1f1c18;
  font-size:15px;
  line-height:1.55;
}
.latex {
  position:relative;
  z-index:1;
  margin:18px 0 24px;
  padding:18px 20px;
  overflow-x:auto;
  border:1px solid #d8cebd;
  background:#f8f2e8;
  font-size:16px;
}
.body {
  position:relative;
  z-index:1;
  max-width:760px;
  margin:0 auto;
  color:#1d1d1d;
  font-size:16px;
  line-height:1.68;
}
.body h1 { font-size:28px; margin:26px 0 12px; }
.body h2 { font-size:24px; margin:26px 0 12px; }
.body h3 { font-size:20px; margin:22px 0 10px; }
.body p { margin:12px 0; }
.body ul { margin:12px 0; padding-left:24px; }
.body li { margin:7px 0; }
.body ol { margin:12px 0; padding-left:24px; }
.body table {
  width:100%;
  margin:18px 0;
  border-collapse:collapse;
  border:1px solid var(--line);
  background:#fffbf3;
  font-size:14px;
}
.body th,
.body td {
  border:1px solid var(--line);
  padding:9px 10px;
  text-align:left;
  vertical-align:top;
}
.body th {
  background:#f0eadf;
  font-weight:740;
}
.body code {
  background:#f0eadf;
  border:1px solid #d4cab8;
  padding:1px 5px;
  color:#111;
  font-family:var(--mono);
  font-size:.88em;
}
.empty {
  color:var(--muted);
  font-family:var(--mono);
  font-size:12px;
  text-align:center;
}
:lang(ko) .body,
:lang(ko) .paper-figure figcaption {
  word-break:keep-all;
  overflow-wrap:anywhere;
  line-height:1.72;
}
@media (max-width: 640px) {
  .page { width:min(100% - 24px, 900px); padding:24px 0 52px; }
  .paper-title { padding:18px 14px 20px; margin-bottom:22px; }
  .block { padding:30px 24px 34px; }
  .block:after { inset:7px; }
  .block-head { grid-template-columns:1fr; gap:10px; }
  .block-title { font-size:26px; }
  .body { font-size:15px; }
}
</style>
</head>
<body>
<main class="page">
  <header class="paper-title">
    <h1>${escapeHtml(state.title || 'Paper reading session')}</h1>
    ${state.source ? `<div class="paper-source">${escapeHtml(state.source)}</div>` : ''}
    <div class="paper-meta">${(cards.cards || []).length} block${(cards.cards || []).length === 1 ? '' : 's'} · updated ${escapeHtml(state.updatedAt || '')}</div>
  </header>
  <section class="blocks">
    ${(cards.cards || []).map((card, index) => `<article id="${escapeHtml(card.id)}" class="block" data-index="${index + 1}"><header class="block-head"><div><h2 class="block-title">${escapeHtml(displayCardTitle(card))}</h2><div class="location">${escapeHtml(card.location)} · ${escapeHtml(card.type)} · ${escapeHtml(card.createdAt || '')}</div></div><span class="folio">Block ${String(index + 1).padStart(2, '0')}</span></header>${renderUserQuestion(card)}${card.latex ? `<div class="latex">$$
${escapeHtml(card.latex)}
$$</div>` : ''}${renderFigure(card.figure, figureExplanationMarkdown(card))}<div class="body">${markdownToHtml(htmlExplanationOnly(bodyWithoutFigureExplanation(card.body || '')))}</div></article>`).join('\n') || '<article class="block empty">No paper blocks yet.</article>'}
  </section>
</main>
</body>
</html>`;
  writeFileSync(indexPath(slug), html);
}


function renderUserQuestion(card) {
  const question = String(card?.userQuestion || '').trim();
  if (!question) return '';
  return `<aside class="user-question"><div class="user-question-label">User question</div><div class="user-question-text">${formatInline(escapeHtml(question))}</div></aside>`;
}

function renderFigure(figure, explanation = '') {
  if (!figure || !figure.src) return '';
  const captionMarkdown = String(explanation || figure.caption || '').trim();
  const caption = captionMarkdown ? `<figcaption>${markdownToHtml(captionMarkdown)}</figcaption>` : '';
  return `<figure class="paper-figure"><img src="${escapeHtml(figure.src)}" alt="${escapeHtml(figure.alt || 'Paper figure')}" loading="lazy" />${caption}</figure>`;
}

function displayCardTitle(card) {
  const title = String(card?.title || card?.type || 'Paper block').trim();
  const bareEquation = title.match(/^Equation\s*\(([^)]+)\)$/i);
  if (bareEquation) return `Equation block — Eq. (${bareEquation[1].trim()})`;
  return title;
}

function normalizeHeading(value) {
  return String(value || '').trim().toLowerCase().replace(/[:.!?]+$/g, '');
}

function isFigureExplanationHeading(title) {
  const normalized = normalizeHeading(title);
  return /^(main\s+method\s+figu?re|main\s+figu?re|representative\s+(method\s+)?figu?re|representative\s+figu?re\s+explanation|figu?re\s+explanation|figu?re\s+explanation\s+under\s+image)$/.test(normalized)
    || /^(그림\s*설명|이미지\s*아래\s*설명|대표\s*(그림|도식|피겨)|대표\s*(그림|도식|피겨)\s*설명|방법\s*(그림|도식|피겨)\s*설명)$/.test(normalized);
}

function splitFigureExplanationSection(markdown) {
  const lines = String(markdown || '').split(/\r?\n/);
  const body = [];
  const figure = [];
  let inFigure = false;
  for (const line of lines) {
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      if (isFigureExplanationHeading(heading[2])) {
        inFigure = true;
        continue;
      }
      if (inFigure) inFigure = false;
    }
    if (inFigure) figure.push(line);
    else body.push(line);
  }
  return { body: body.join('\n').trim(), figure: figure.join('\n').trim() };
}

function bodyWithoutFigureExplanation(markdown) {
  return splitFigureExplanationSection(markdown).body;
}

function stripBulletLabel(line) {
  return String(line || '')
    .replace(/^-\s+/, '')
    .replace(/^\*\*([^*]+)\*\*:\s*/, '$1: ')
    .trim();
}

function labeledFigureFacts(markdown) {
  const facts = {};
  for (const raw of String(markdown || '').split(/\r?\n/)) {
    const line = stripBulletLabel(raw);
    const match = line.match(/^([^:]{2,80}):\s*(.+)$/);
    if (!match) continue;
    const key = normalizeHeading(match[1]).replace(/\s+or\s+/g, ' / ');
    facts[key] = match[2].trim();
  }
  return facts;
}

function sentence(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function figureExplanationMarkdown(card) {
  if (!card?.figure) return '';
  const section = splitFigureExplanationSection(card.body || '').figure;
  const facts = labeledFigureFacts(section);
  const rawSemanticCaption = String(card.figure.caption || '').trim();
  const semanticCaption = isProvenanceOnlyCaption(rawSemanticCaption) ? '' : rawSemanticCaption;
  const korean = containsKorean(section || card.body || card.title);
  const identity = semanticCaption
    || facts['figure / location']
    || facts['figure location']
    || facts['그림 / 위치']
    || facts['그림 위치']
    || facts['위치']
    || '';
  const what = facts['what it shows']
    || facts['why this is the representative figure']
    || facts['why this figure matters']
    || facts['무엇을 보여주는가']
    || facts['보여주는 것']
    || facts['왜 대표 그림인가']
    || facts['왜 이 그림이 중요한가']
    || '';
  const flow = facts['flow / sequence']
    || facts['flow or sequence']
    || facts['흐름 / 순서']
    || facts['흐름 또는 순서']
    || facts['읽는 법']
    || facts['해석 순서']
    || '';
  const observe = facts['what to observe']
    || facts['관찰할 점']
    || facts['핵심 관찰']
    || facts['봐야 할 점']
    || '';
  const supports = facts['equations / claims it supports']
    || facts['equations or claims it supports']
    || facts['연결되는 수식 / 주장']
    || facts['연결되는 수식 또는 주장']
    || facts['지원하는 수식 또는 주장']
    || facts['관련 수식']
    || '';
  const parts = [];
  if (identity) parts.push(`**${sentence(identity)}**`);
  if (what) parts.push(sentence(what));
  const reading = [
    flow && (korean ? `읽는 법: ${sentence(flow)}` : `Read it as ${sentence(flow).replace(/^./, (ch) => ch.toLowerCase())}`),
    observe && (korean ? `핵심 관찰: ${sentence(observe)}` : `The key observation is that ${sentence(observe).replace(/^the\s+/i, '')}`)
  ]
    .filter(Boolean)
    .join(' ');
  if (reading) parts.push(reading);
  if (supports) parts.push(korean ? `연결되는 내용: ${sentence(supports)}` : `This visual anchors ${sentence(supports).replace(/^the\s+/i, '')}`);
  if (parts.length) return parts.join('\n\n');
  if (section.trim()) return section.trim();
  return semanticCaption;
}

function htmlExplanationOnly(markdown) {
  const lines = String(markdown || '').split(/\r?\n/);
  const kept = [];
  let skipping = false;
  for (const line of lines) {
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const title = heading[2].trim().toLowerCase().replace(/[:.!?]+$/g, '');
      skipping = /^(cli-only.*|likely\s+blockers?|blockers?|likely\s+confusion.*|confusion\s+risk.*|recommended\s+next|next\s+actions?|choose\s+next|diagnostic\s+questions?)$/.test(title);
      if (skipping) continue;
    }
    if (!skipping) kept.push(line);
  }
  return kept.join('\n').trim();
}

function markdownToHtml(markdown) {
  const escaped = escapeHtml(markdown);
  const lines = escaped.split(/\r?\n/);
  let html = '';
  let listType = '';
  let tableRows = [];
  const closeList = () => {
    if (!listType) return;
    html += `</${listType}>`;
    listType = '';
  };
  const isTableRow = (line) => /^\s*\|.+\|\s*$/.test(line);
  const isTableSeparator = (line) => /^\s*\|?(\s*:?-{3,}:?\s*\|)+\s*$/.test(line);
  const tableCells = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
  const closeTable = () => {
    if (!tableRows.length) return;
    const [head, ...body] = tableRows;
    html += '<table><thead><tr>';
    for (const cell of head) html += `<th>${formatInline(cell)}</th>`;
    html += '</tr></thead>';
    if (body.length) {
      html += '<tbody>';
      for (const row of body) {
        html += '<tr>';
        for (const cell of row) html += `<td>${formatInline(cell)}</td>`;
        html += '</tr>';
      }
      html += '</tbody>';
    }
    html += '</table>';
    tableRows = [];
  };
  const closeBlocks = () => { closeList(); closeTable(); };
  const displayMathBlock = (delimiter, endDelimiter, index) => {
    const collected = [lines[index]];
    let cursor = index;
    if (lines[index].trim() !== endDelimiter) {
      cursor += 1;
      while (cursor < lines.length) {
        collected.push(lines[cursor]);
        if (lines[cursor].trim() === endDelimiter || (endDelimiter === '$$' && lines[cursor].trim().endsWith('$$') && cursor !== index)) break;
        cursor += 1;
      }
    }
    closeBlocks();
    html += `<div class="latex">${collected.join('\n')}</div>`;
    return cursor;
  };
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed === '\\[') { i = displayMathBlock('\\[', '\\]', i); }
    else if (trimmed === '$$' || (trimmed.startsWith('$$') && !trimmed.endsWith('$$'))) { i = displayMathBlock('$$', '$$', i); }
    else if (isTableRow(line)) {
      closeList();
      if (!isTableSeparator(line)) tableRows.push(tableCells(line));
    }
    else if (/^###\s+/.test(line)) { closeBlocks(); html += `<h3>${line.replace(/^###\s+/, '')}</h3>`; }
    else if (/^##\s+/.test(line)) { closeBlocks(); html += `<h2>${line.replace(/^##\s+/, '')}</h2>`; }
    else if (/^#\s+/.test(line)) { closeBlocks(); html += `<h1>${line.replace(/^#\s+/, '')}</h1>`; }
    else if (/^-\s+/.test(line)) {
      closeTable();
      if (listType !== 'ul') { closeList(); html += '<ul>'; listType = 'ul'; }
      html += `<li>${formatInline(line.replace(/^-\s+/, ''))}</li>`;
    }
    else if (/^\d+\.\s+/.test(line)) {
      closeTable();
      if (listType !== 'ol') { closeList(); html += '<ol>'; listType = 'ol'; }
      html += `<li>${formatInline(line.replace(/^\d+\.\s+/, ''))}</li>`;
    }
    else if (trimmed === '') { closeBlocks(); }
    else { closeBlocks(); html += `<p>${formatInline(line)}</p>`; }
  }
  closeBlocks();
  return html;
}

function formatInline(value) {
  return value
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>');
}

function line(width = 74) { return '─'.repeat(width); }
function trim(value, width = 62) {
  const s = String(value || '');
  return s.length > width ? `${s.slice(0, width - 1)}…` : s;
}
function printConsole(state, cards = readJson(cardsPath(state.slug), { cards: [] })) {
  const width = 74;
  console.log(`╭─ PaperMentor Reading Console ${line(width - 29)}╮`);
  console.log(`│ Paper: ${trim(state.title, width - 10).padEnd(width - 8)} │`);
  console.log(`│ Location: ${trim(state.currentLocation, width - 13).padEnd(width - 11)} │`);
  console.log(`│ Focus: ${trim(state.currentFocus, width - 10).padEnd(width - 8)} │`);
  console.log(`│ View: ${trim(state.renderedView, width - 9).padEnd(width - 7)} │`);
  console.log(`╰${line(width)}╯`);
  console.log('\nReading Path');
  for (const item of state.readingPath || []) {
    const mark = item.status === 'done' ? '✓' : item.status === 'current' ? '›' : item.status === 'blocked' ? '!' : ' ';
    console.log(`  [${mark}] ${item.label}`);
  }
  console.log('\nChoose next:');
  (state.nextChoices || []).forEach((choice, index) => console.log(`  [${index + 1}] ${choice}`));
  console.log(`\nCards: ${(cards.cards || []).length} · Open ${state.renderedView}`);
}

function usage() {
  console.log(`PaperMentor session helper\n\nUsage:\n  node scripts/papermentor-session.mjs start --title <title> [--source <url>] [--slug <slug>]\n  node scripts/papermentor-session.mjs card --session <slug> --type equation --title <title> [--latex <tex>] [--user-question <text>] [--figure-file <path>] [--figure-caption <text>] [--body <text>|--body-file <path>] [--choices "A|B|C"]\n  node scripts/papermentor-session.mjs turn --session <slug> --role user --text <text> [--promote|--no-promote]\n  node scripts/papermentor-session.mjs promote --session <slug> --title <title> --user-question <text> --body-file <path>\n  node scripts/papermentor-session.mjs status --session <slug>\n`);
}

const args = parseArgs(process.argv.slice(2));
const command = args._[0];
try {
  if (command === 'start') {
    const title = args.title || 'Paper reading session';
    const slug = args.slug || slugify(title);
    const source = args.source || '';
    const { state, cards } = ensureSession({ title, source, slug });
    printConsole(state, cards);
  } else if (command === 'card') {
    addCard(args);
  } else if (command === 'turn') {
    appendTurn(args);
  } else if (command === 'promote') {
    addCard({ ...args, type: args.type || 'confusion' });
  } else if (command === 'status') {
    const slug = args.session || args.slug;
    if (!slug) throw new Error('status requires --session <slug>');
    renderHtml(slug);
    printConsole(readJson(statePath(slug), {}));
  } else {
    usage();
    process.exit(command ? 1 : 0);
  }
} catch (error) {
  console.error(`PaperMentor session error: ${error.message}`);
  process.exit(1);
}
