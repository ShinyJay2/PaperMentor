#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = process.cwd();
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
function indexPath(slug) { return join(sessionDir(slug), 'index.html'); }

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
    'paper-map': 'map', scan: 'map', equation: 'equations', 'equation-card': 'equations', derivation: 'derivations',
    dependency: 'dependencies', dependencies: 'dependencies', confusion: 'confusion', why: 'confusion', final: 'final',
    'final-insight': 'final'
  };
  return map[type] || null;
}

function readBody(args) {
  if (args['body-file']) return readFileSync(resolve(args['body-file']), 'utf8');
  if (args.body) return args.body;
  return '';
}

function splitChoices(value) {
  if (!value) return [];
  return String(value).split('|').map((x) => x.trim()).filter(Boolean);
}

function addCard(args) {
  const slug = args.session || args.slug;
  if (!slug) throw new Error('card requires --session <slug>');
  const state = readJson(statePath(slug), null);
  if (!state) throw new Error(`session not found: ${slug}`);
  const cards = readJson(cardsPath(slug), { schema: 'papermentor.cards.v1', cards: [] });
  const type = args.type || 'note';
  const card = {
    id: args.id || `${type}-${String(cards.cards.length + 1).padStart(3, '0')}`,
    type,
    title: args.title || type,
    location: args.location || state.currentLocation,
    latex: args.latex || '',
    body: readBody(args),
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
  appendFileSync(notesPath(slug), `\n## ${card.title}\n\nLocation: ${card.location}\n\n${card.latex ? `$$\n${card.latex}\n$$\n\n` : ''}${card.body}\n`);
  renderHtml(slug);
  printConsole(state, cards);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function statusIcon(status) {
  return { done: '✓', current: '›', pending: ' ', blocked: '!', review: '↺' }[status] || ' ';
}

function statusClass(status) {
  return { done: 'done', current: 'current', pending: 'pending', blocked: 'blocked', review: 'review' }[status] || 'pending';
}

function renderHtml(slug) {
  const state = readJson(statePath(slug), {});
  const cards = readJson(cardsPath(slug), { cards: [] });
  const data = JSON.stringify({ state, cards }, null, 2).replace(/<\//g, '<\\/');
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>PaperMentor · ${escapeHtml(state.title)}</title>
<script>
window.MathJax = { tex: { inlineMath: [['$', '$'], ['\\\\(', '\\\\)']], displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']] }, svg: { fontCache: 'global' } };
</script>
<script defer src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js"></script>
<style>
:root {
  color-scheme: light;
  --field:#f4f1e8;
  --paper:#fffdf8;
  --ink:#191919;
  --muted:#6f6a60;
  --line:#c9bfae;
  --rule:#222;
  --accent:#2f54b8;
  --mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  --serif: "Times New Roman", Times, Charter, Georgia, serif;
}
* { box-sizing:border-box; }
html { scroll-behavior:smooth; }
body {
  margin:0;
  color:var(--ink);
  font-family:var(--serif);
  background:
    linear-gradient(90deg, rgba(47,84,184,.04) 1px, transparent 1px),
    linear-gradient(180deg, rgba(47,84,184,.04) 1px, transparent 1px),
    var(--field);
  background-size:28px 28px;
}
.page {
  width:min(920px, calc(100% - 40px));
  margin:0 auto;
  padding:44px 0 80px;
}
.blocks { display:grid; gap:26px; }
.block {
  position:relative;
  background:var(--paper);
  border:1px solid var(--line);
  padding:42px 56px 50px;
  box-shadow:0 1px 0 rgba(0,0,0,.04);
}
.block:before {
  content:attr(data-index);
  position:absolute;
  left:-1px;
  top:-1px;
  width:38px;
  height:34px;
  display:grid;
  place-items:center;
  border-right:1px solid var(--line);
  border-bottom:1px solid var(--line);
  background:#f1eadf;
  color:var(--accent);
  font-family:var(--mono);
  font-size:13px;
  font-weight:700;
}
.block-head {
  border-bottom:1px solid var(--rule);
  padding-bottom:12px;
  margin-bottom:22px;
}
.block h1,
.block h2,
.block h3 {
  color:var(--ink);
  font-family:var(--serif);
  font-weight:700;
  line-height:1.12;
  letter-spacing:-.015em;
}
.block-title {
  margin:0;
  font-size:31px;
}
.location {
  margin-top:7px;
  color:var(--muted);
  font-family:var(--mono);
  font-size:10px;
  letter-spacing:.04em;
  text-transform:uppercase;
}
.latex {
  margin:18px 0 24px;
  padding:18px 20px;
  overflow-x:auto;
  border:1px solid #d8cebd;
  background:#f8f2e8;
  font-size:16px;
}
.body {
  max-width:760px;
  margin:0 auto;
  color:#1d1d1d;
  font-size:17px;
  line-height:1.62;
}
.body h1 { font-size:28px; margin:26px 0 12px; }
.body h2 { font-size:24px; margin:26px 0 12px; }
.body h3 { font-size:20px; margin:22px 0 10px; }
.body p { margin:12px 0; }
.body ul { margin:12px 0; padding-left:24px; }
.body li { margin:7px 0; }
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
@media (max-width: 640px) {
  .page { width:min(100% - 24px, 920px); padding:24px 0 52px; }
  .block { padding:54px 24px 32px; }
  .block-title { font-size:26px; }
  .body { font-size:16px; }
}
</style>
</head>
<body>
<main class="page">
  <section class="blocks">
    ${(cards.cards || []).map((card, index) => `<article id="${escapeHtml(card.id)}" class="block" data-index="${index + 1}"><header class="block-head"><h2 class="block-title">${escapeHtml(card.title)}</h2><div class="location">${escapeHtml(card.location)} · ${escapeHtml(card.type)} · ${escapeHtml(card.createdAt || '')}</div></header>${card.latex ? `<div class="latex">$$
${escapeHtml(card.latex)}
$$</div>` : ''}<div class="body">${markdownToHtml(card.body || '')}</div></article>`).join('\n') || '<article class="block empty" data-index="0">No paper blocks yet.</article>'}
  </section>
</main>
<script id="papermentor-data" type="application/json">${data}</script>
</body>
</html>`;
  writeFileSync(indexPath(slug), html);
}

function markdownToHtml(markdown) {
  const escaped = escapeHtml(markdown);
  const lines = escaped.split(/\r?\n/);
  let html = '';
  let inList = false;
  for (const line of lines) {
    if (/^###\s+/.test(line)) { if (inList) { html += '</ul>'; inList = false; } html += `<h3>${line.replace(/^###\s+/, '')}</h3>`; }
    else if (/^##\s+/.test(line)) { if (inList) { html += '</ul>'; inList = false; } html += `<h2>${line.replace(/^##\s+/, '')}</h2>`; }
    else if (/^#\s+/.test(line)) { if (inList) { html += '</ul>'; inList = false; } html += `<h1>${line.replace(/^#\s+/, '')}</h1>`; }
    else if (/^-\s+/.test(line)) { if (!inList) { html += '<ul>'; inList = true; } html += `<li>${formatInline(line.replace(/^-\s+/, ''))}</li>`; }
    else if (line.trim() === '') { if (inList) { html += '</ul>'; inList = false; } }
    else { if (inList) { html += '</ul>'; inList = false; } html += `<p>${formatInline(line)}</p>`; }
  }
  if (inList) html += '</ul>';
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
  console.log(`PaperMentor session helper\n\nUsage:\n  node scripts/papermentor-session.mjs start --title <title> [--source <url>] [--slug <slug>]\n  node scripts/papermentor-session.mjs card --session <slug> --type equation --title <title> [--latex <tex>] [--body <text>|--body-file <path>] [--choices "A|B|C"]\n  node scripts/papermentor-session.mjs status --session <slug>\n`);
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
